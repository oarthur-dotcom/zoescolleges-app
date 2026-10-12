// #68 Step 4: six places + section tabs; phone bar of five; search that jumps anywhere. Run: node tests/nav-v2-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f68/site', SHOTS = '/tmp/claude-0/f68/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8905);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['desktop-dark', { width: 1280, height: 900 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8905/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(700);
  const o = {}; const phone = vp.width < 900;
  o.top = await page.evaluate(() => ({ desk: [...document.querySelectorAll('#appnav .navbtn')].filter(b => !b.dataset.hasOwnProperty('cmdk')).map(b => b.textContent.trim()), overflow: (() => { const n = document.getElementById('appnav'); return n.scrollWidth > n.clientWidth + 2; })(), bar: [...document.querySelectorAll('#tabbar .tb .tb-l')].map(x => x.textContent) }));
  // Schools group -> board with section tabs
  if (phone) await page.click('#tabbar [data-grp="schools"]'); else await page.click('#appnav [data-grp="schools"]');
  await page.waitForTimeout(400);
  o.schools = await page.evaluate(() => ({ view: currentView, tabs: [...document.querySelectorAll('#subnav .sn-tab')].map(x => x.textContent.trim()), on: (document.querySelector('#subnav .sn-tab.on') || {}).textContent }));
  await page.click('#subnav [data-nav="compare"]'); await page.waitForTimeout(400); o.cmp = await page.evaluate(() => currentView);
  // Plan group remembers nothing yet -> Deadlines first; go to Costs, then Schools, then Plan again -> Costs (remembered)
  if (phone) await page.click('#tabbar [data-grp="plan"]'); else await page.click('#appnav [data-grp="plan"]'); await page.waitForTimeout(300);
  o.plan1 = await page.evaluate(() => currentView); await page.click('#subnav [data-nav="cost"]'); await page.waitForTimeout(300);
  if (phone) { await page.click('#tabbar [data-grp="schools"]'); await page.waitForTimeout(200); await page.click('#tabbar [data-grp="plan"]'); } else { await page.click('#appnav [data-grp="schools"]'); await page.waitForTimeout(200); await page.click('#appnav [data-grp="plan"]'); }
  await page.waitForTimeout(300); o.plan2 = await page.evaluate(() => currentView);
  o.planDot = await page.evaluate(() => { const d = document.querySelector(document.querySelector('#tabbar').offsetParent ? '[data-tb-badge="deadlines"]' : '[data-grp-dot="plan"]'); return d && !d.classList.contains('hidden'); });
  await page.screenshot({ path: `${SHOTS}${label}-plan.png` });
  // Family group
  if (phone) await page.click('#tabbar [data-grp="family"]'); else await page.click('#appnav [data-grp="family"]'); await page.waitForTimeout(300);
  o.family = await page.evaluate(() => ({ view: currentView, tabs: [...document.querySelectorAll('#subnav .sn-tab')].map(x => x.textContent.trim()) }));
  // Phone More sheet
  if (phone) { await page.click('[data-tb-more]'); await page.waitForTimeout(200); o.sheet = await page.evaluate(() => [...document.querySelectorAll('#tb-sheet .tbs b')].map(x => x.textContent)); await page.screenshot({ path: `${SHOTS}${label}-more.png` });
    await page.click('#tb-sheet .tbs[data-ptab-go="who"]'); await page.waitForTimeout(400); o.prio = await page.evaluate(() => currentView + '|' + !document.getElementById('pf-who').classList.contains('hidden')); }
  // Search anywhere
  await page.evaluate(() => goto('today')); await page.waitForTimeout(200);
  if (phone) { await page.click('[data-tb-more]'); await page.click('#tb-sheet [data-cmdk]'); } else await page.keyboard.press('Control+k');
  await page.waitForTimeout(200); o.cmdOpen = await page.evaluate(() => document.getElementById('dlg-cmd').open);
  await page.fill('#cmd-q', 'charleston cost'); await page.waitForTimeout(200);
  o.r1 = await page.evaluate(() => [...document.querySelectorAll('.cmd-it .cmd-t')].map(x => x.textContent));
  await page.screenshot({ path: `${SHOTS}${label}-search.png` });
  await page.keyboard.press('Enter'); await page.waitForTimeout(700); o.afterCost = await page.evaluate(() => ({ view: currentView, id: currentDetailId, flash: !!document.querySelector('.cmd-flash') }));
  await page.evaluate(() => openCmd()); await page.fill('#cmd-q', 'add stanferd'); await page.waitForTimeout(200); o.r2 = await page.evaluate(() => [...document.querySelectorAll('.cmd-it .cmd-t')].map(x => x.textContent));
  await page.keyboard.press('Enter'); await page.waitForTimeout(600); o.added = await page.evaluate(() => window.__writes.filter(x => x.table === 'family_schools' && x.op === 'insert').map(x => x.p.name));
  await page.evaluate(() => openCmd()); await page.fill('#cmd-q', 'deadlines'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); await page.waitForTimeout(400); o.dl = await page.evaluate(() => currentView);
  await page.evaluate(() => openCmd()); await page.fill('#cmd-q', 'invite'); await page.waitForTimeout(200); o.r3 = await page.evaluate(() => [...document.querySelectorAll('.cmd-it .cmd-t')].map(x => x.textContent)); await page.keyboard.press('Escape');
  if (!phone) { await page.evaluate(() => goto('board')); await page.waitForTimeout(200); await page.keyboard.press('/'); await page.waitForTimeout(200); o.slash = await page.evaluate(() => document.getElementById('dlg-cmd').open); await page.keyboard.press('Escape'); }
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close(); R[label] = o;
  ok[label + '.sixPlaces'] = phone ? o.top.bar.join('|') === 'Today|Schools|Plan|Family|More' : (o.top.desk.join('|') === 'Today|Schools|Plan|Family|Ask Zoe|Profile' && !o.top.overflow);
  ok[label + '.sectionTabs'] = o.schools.view === 'board' && o.schools.tabs.join('|').replace(/\d+/g, '') === 'My Board|Discover|Search|Zoe Picks|Compare|Pulse' && o.schools.on === 'My Board' && o.cmp === 'compare';
  ok[label + '.remembersPlace'] = o.plan1 === 'deadlines' && o.plan2 === 'cost';
  ok[label + '.deadlineDotOnPlan'] = o.planDot === true;
  ok[label + '.familyGroup'] = o.family.view === 'journey' && o.family.tabs.join('|') === 'Journey|Talk It Out|Decision Day|Memories';
  if (phone) ok[label + '.moreSheetShort'] = o.sheet.join('|') === 'Search|Ask Zoe|Profile|My priorities|College Report' && o.prio === 'profile|true';
  ok[label + '.searchCost'] = o.cmdOpen && /College of Charleston — cost/.test(o.r1[0] || '') && o.afterCost.view === 'detail' && o.afterCost.id === 'college-of-charleston' && o.afterCost.flash;
  ok[label + '.searchAddWithTypo'] = /Add Stanford/.test(o.r2[0] || '') && o.added.some(n => /Stanford/.test(n));
  ok[label + '.searchPagesAndActions'] = o.dl === 'deadlines' && o.r3.includes('Invite family');
  if (!phone) ok[label + '.slashOpens'] = o.slash === true;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./nav-v2-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
