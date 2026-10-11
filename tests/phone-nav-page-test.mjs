// #40 phone bottom tab bar + More sheet + nav badges. Run: node tests/phone-nav-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f40/site', SHOTS = '/tmp/claude-0/f40/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), DL = fs.readFileSync('/tmp/claude-0/f33/dl.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8800);
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['phone-dark', { width: 390, height: 844 }, true], ['small-phone', { width: 360, height: 700 }], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DL }));
  await page.route('**/.netlify/functions/campus-pulse*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schools: { 'sc-166683': { top: [{ title: 'MIT news', link: 'https://news.mit.edu/a', date: ago(1), kind: 'news' }], stories: [{ title: 'MIT news', link: 'https://news.mit.edu/a', date: ago(1), kind: 'news' }, { title: 'MIT 2', link: 'https://news.mit.edu/b', date: ago(2), kind: 'news' }], visits: [] } }, pending: [], none: [] }) }));
  await page.goto('http://localhost:8800/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => goto('board')); await page.waitForTimeout(700);   // #48: the app now opens on Today
  const o = {};
  o.topNavVisible = await page.evaluate(() => getComputedStyle(document.getElementById('appnav')).display !== 'none');
  o.tabbarVisible = await page.evaluate(() => { const t = document.getElementById('tabbar'); return getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().bottom <= innerHeight + 1; });
  o.tabs = await page.evaluate(() => [...document.querySelectorAll('#tabbar .tb')].map(b => b.innerText.replace(/\s+/g, ' ').trim() + (b.classList.contains('active') ? '*' : '')));
  o.badges = await page.evaluate(() => [...document.querySelectorAll('#tabbar .tb-badge')].map(x => x.dataset.tbBadge + ':' + (x.classList.contains('hidden') ? 'off' : 'on' + (x.textContent ? '(' + x.textContent + ')' : ''))));
  o.deskDot = await page.evaluate(() => !!document.querySelector('#appnav .navbtn[data-nav="deadlines"] .nav-dot'));
  o.fabsAboveBar = await page.evaluate(() => { const t = document.getElementById('tabbar').getBoundingClientRect(); const f = [document.getElementById('fab-add'), document.getElementById('zoe-fab')].filter(x => x && getComputedStyle(x).display !== 'none').map(x => x.getBoundingClientRect()); return f.every(r => r.bottom <= t.top + 1); });
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  if (vp.width <= 640) {
    await page.click('#tabbar [data-nav="pulse"]'); await page.waitForTimeout(400);
    o.pulseOpens = await page.evaluate(() => !document.getElementById('v-pulse').classList.contains('hidden') && document.querySelector('#tabbar [data-nav="pulse"]').classList.contains('active'));
    await page.click('#tabbar [data-tb-more]'); await page.waitForTimeout(250);
    o.sheet = await page.evaluate(() => [...document.querySelectorAll('#tb-sheet .tbs')].map(b => b.innerText.replace(/\s+/g, ' ')));
    await page.screenshot({ path: `${SHOTS}${label}-more.png` });
    await page.click('#tb-sheet [data-nav="trip"]'); await page.waitForTimeout(400);
    o.tripOpens = await page.evaluate(() => !document.getElementById('v-trip').classList.contains('hidden') && document.getElementById('tb-sheet').classList.contains('hidden') && document.querySelector('#tabbar [data-tb-more]').classList.contains('active'));
    await page.click('#tabbar [data-tb-more]'); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    o.escCloses = await page.evaluate(() => document.getElementById('tb-sheet').classList.contains('hidden'));
    await page.evaluate(() => goto('explore')); await page.waitForTimeout(500);
    o.lastRowReachable = await page.evaluate(() => { scrollTo(0, document.body.scrollHeight); const rows = [...document.querySelectorAll('#v-explore .srow')]; const last = rows[rows.length - 1]; if (!last) return 'no rows'; const r = last.getBoundingClientRect(), t = document.getElementById('tabbar').getBoundingClientRect(); return r.bottom <= t.top; });
  }
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  if (vp.width <= 640) {
    ok[label + '.bottomBarNotTopNav'] = o.tabbarVisible && !o.topNavVisible;
    ok[label + '.fiveTabs'] = o.tabs.length === 5 && /^☀️ Today$/.test(o.tabs[0]) && /^📋 Board\*$/.test(o.tabs[1]);
    ok[label + '.pulseCountBadge'] = o.badges.includes('pulse:on(2)');
    ok[label + '.deadlineDot'] = o.badges.includes('deadlines:on');
    ok[label + '.fabsAboveBar'] = o.fabsAboveBar;
    ok[label + '.pulseTab'] = o.pulseOpens;
    ok[label + '.moreSheet'] = o.sheet.length === 8 && /Schools/.test(o.sheet[0]) && /Costs/.test(o.sheet[2]) && /Trips/.test(o.sheet[4]) && /Memories/.test(o.sheet[5]) && o.tripOpens && o.escCloses;
    ok[label + '.lastRowNotHidden'] = o.lastRowReachable === true;
    ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
  } else {
    ok[label + '.topNavUnchanged'] = o.topNavVisible && !o.tabbarVisible;
    ok[label + '.deadlinesDotOnTopNav'] = o.deskDot;
  }
  ok[label + '.noErrors'] = !o.errors.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./phone-nav-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
