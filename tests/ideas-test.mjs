// #71 Ideas 2, 4, 5: swipe to discover with family matches; calmer cards; the journey + weekly recap.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f71/site', SHOTS = '/tmp/claude-0/f71/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8908);
const UID2 = '22222222-2222-2222-2222-222222222222';
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8908/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  // Idea 4: calmer cards
  await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
  o.cards = await page.evaluate(() => { const c = [...document.querySelectorAll('#schools .school')]; return { n: c.length, big3: c.filter(x => x.querySelectorAll('.big3 .b3').length === 3).length, labels: [...(c[0] || document).querySelectorAll('.b3-k')].map(x => x.textContent), moreClosed: c.every(x => !x.querySelector('details.card-more').open), visibleBtns: c[0] ? [...c[0].querySelectorAll('button')].filter(b2 => b2.offsetParent !== null && !b2.closest('.raters')).length : 0 }; });
  // Idea 5: weekly recap on Today
  await page.evaluate(() => { const z = state.members.find(m => m.role === 'student'); state.profiles[z.user_id] = { user_id: z.user_id, gpa: '3.8' }; state.prefs[state.me.user_id] = { ...defaultPrefs(), value: 9 }; goto('today'); }); await page.waitForTimeout(400);
  o.recap = await page.evaluate(() => (document.querySelector('.td-recap') || {}).innerText || '');
  // Idea 2: Discover
  if (vp.width < 900) await page.click('#tabbar [data-grp="schools"]'); else await page.click('#appnav [data-grp="schools"]'); await page.waitForTimeout(300);
  await page.click('#subnav [data-nav="discover"]'); await page.waitForTimeout(600);
  o.disc = await page.evaluate(() => ({ view: currentView, top: (document.querySelector('.disc-stage > .disc-card .disc-nm b') || {}).textContent, id: (document.querySelector('.disc-stage > .disc-card') || {}).dataset?.disc, b3: document.querySelectorAll('.disc-stage > .disc-card .b3').length, under: !!document.querySelector('.disc-under') }));
  await page.screenshot({ path: `${SHOTS}${label}-discover.png` });
  await page.click('[data-discgo="yes"]'); await page.waitForTimeout(500);
  o.yes = await page.evaluate((id) => ({ w: window.__writes.filter(x => x.table === 'swipes' && x.op === 'upsert').map(x => x.p.school_id + ':' + x.p.verdict), next: (document.querySelector('.disc-stage > .disc-card') || {}).dataset?.disc, undo: !!document.querySelector('[data-discundo]'), likes: document.querySelectorAll('.disc-like').length }), o.disc.id);
  await page.click('[data-discundo]'); await page.waitForTimeout(400); o.undo = await page.evaluate(() => ({ back: (document.querySelector('.disc-stage > .disc-card') || {}).dataset?.disc, del: window.__writes.filter(x => x.table === 'swipes' && x.op === 'delete').length }));
  // drag the card right = yes
  const box = await page.locator('.disc-stage > .disc-card').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 120); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + 125, { steps: 4 }); await page.mouse.move(box.x + box.width / 2 + 170, box.y + 130, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(500);
  o.drag = await page.evaluate((id) => swipes.filter(x => x.school_id === id && x.user_id === state.me.user_id).map(x => x.verdict)[0], o.disc.id);
  // keyboard left = no (desktop only — phones don't have arrows)
  if (vp.width >= 900) { const before = await page.evaluate(() => document.querySelector('.disc-stage > .disc-card').dataset.disc); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(400); o.key = await page.evaluate((id) => swipes.find(x => x.school_id === id && x.user_id === state.me.user_id)?.verdict, before); }
  // a family match
  const nextId = await page.evaluate(() => document.querySelector('.disc-stage > .disc-card').dataset.disc);
  await page.evaluate(([id, u2]) => { swipes.push({ user_id: u2, family_id: state.family.id, school_id: id, verdict: 'yes', created_at: new Date().toISOString() }); }, [nextId, UID2]);
  await page.evaluate((id) => { _discDeck = null; renderDiscover(); const i = _discDeck.findIndex(x => x.c.id === id); if (i > 0) _discDeck.unshift(..._discDeck.splice(i, 1)); renderDiscover(); }, nextId); await page.waitForTimeout(300);
  o.famLiked = await page.evaluate((id) => (document.querySelector(`.disc-card[data-disc="${id}"] .disc-fam`) || {}).textContent || '', nextId);
  await page.click('[data-discgo="yes"]'); await page.waitForTimeout(500);
  o.match = await page.evaluate(() => ({ cel: (document.querySelector('.celebrate') || {}).innerText || '', banner: (document.querySelector('.disc-match') || {}).innerText || '' }));
  await page.evaluate(() => { const x = document.querySelector('[data-celx]'); if (x) x.click(); }); await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}${label}-match.png` });
  await page.click('.disc-match [data-discadd]'); await page.waitForTimeout(500);
  o.added = await page.evaluate((id) => window.__writes.filter(x => x.table === 'family_schools' && x.op === 'insert').map(x => x.p.school_id).includes(id), nextId);
  // Idea 5: journey
  await page.evaluate(() => goto('journey')); await page.waitForTimeout(400);
  o.journey = await page.evaluate(() => ({ text: document.getElementById('jr-out').innerText, stages: document.querySelectorAll('.jr-stages span').length, tabs: [...document.querySelectorAll('#subnav .sn-tab')].map(x => x.textContent.trim()) }));
  await page.screenshot({ path: `${SHOTS}${label}-journey.png`, fullPage: true });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close(); R[label] = o;
  ok[label + '.calmCards'] = o.cards.n === 6 && o.cards.big3 === 6 && /cost/i.test(o.cards.labels[0]) && /Chance/i.test(o.cards.labels[1]) && /Family/i.test(o.cards.labels[2]) && o.cards.moreClosed && o.cards.visibleBtns <= 5;
  ok[label + '.weeklyRecap'] = /This week/i.test(o.recap) && /6 schools added/.test(o.recap);
  ok[label + '.discoverCard'] = o.disc.view === 'discover' && !!o.disc.top && o.disc.b3 === 3 && o.disc.under;
  ok[label + '.yesSavedAndAdvances'] = o.yes.w.includes(o.disc.id + ':yes') && o.yes.next !== o.disc.id && o.yes.undo && o.yes.likes >= 1;
  ok[label + '.undo'] = o.undo.back === o.disc.id && o.undo.del >= 1;
  ok[label + '.dragToSwipe'] = o.drag === 'yes';
  if (vp.width >= 900) ok[label + '.arrowKeys'] = o.key === 'no';
  ok[label + '.familyMatch'] = /Zoe liked this/.test(o.famLiked) && /match/i.test(o.match.cel) && /^💛 You and Zoe both liked/.test(o.match.banner) && o.added;
  ok[label + '.journey'] = /Arthur Family started|Added 6 schools/.test(o.journey.text) && /Coming up/i.test(o.journey.text) && o.journey.stages === 4 && o.journey.tabs[0] === 'Journey';
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./ideas-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
