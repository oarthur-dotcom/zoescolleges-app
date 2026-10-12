// Release 9 (Oct 12): Zoe Picks facts row + Show more, school-page size line, page-aware Ask Zoe, board order holds
// while rating (+ Undo), how-to buttons, landing video, tour once after sign-up. Run: node tests/release9-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const APP = new URL('..', import.meta.url).pathname;
const SITE = '/tmp/claude-0/r9t/site', SHOTS = '/tmp/claude-0/r9t/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(APP + 'index.html', SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/media/') ? path.join(APP, u) : path.join(SITE, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8841);
const ok = {}, R = {};
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {});
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|wikimedia/, r => r.abort());
  let aiBody = null; await page.route(/functions\/zoe-ai/, async r => { aiBody = JSON.parse(r.request().postData() || '{}'); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Page-aware answer.' }) }); });
  await page.goto('http://localhost:8841/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && state.schools && state.schools.length > 2, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  // Zoe Picks: facts row + show more
  await page.evaluate(() => goto('recommends')); await page.waitForTimeout(700);
  o.rec = await page.evaluate(() => { const c = document.querySelector('#rec-out .rec-card'); const f = c && c.querySelector('.rec-facts'); return { cards: document.querySelectorAll('#rec-out .rec-card').length, facts: f ? [...f.querySelectorAll('.rf')].map(x => x.innerText.replace(/\s+/g, ' ')) : null, more: !!document.querySelector('[data-recmore]') }; });
  await page.screenshot({ path: `${SHOTS}${label}-picks.png` });
  if (o.rec.more) { const n0 = o.rec.cards; await page.click('[data-recmore]'); await page.waitForTimeout(500); o.recAfter = await page.evaluate(() => document.querySelectorAll('#rec-out .rec-card').length); o.recGrew = o.recAfter > n0; } else o.recGrew = 'n/a';
  o.howtoPicks = await page.evaluate(() => !!document.querySelector('#v-recommends .howto-btn, .howto-btn[data-howto="recommends"]'));
  // school page size line
  const sid = await page.evaluate(() => { const c = state.catalog.find(x => x.scorecard && x.scorecard.size > 15000); openDetail(c.id, 'recommends'); return c.id; }); await page.waitForTimeout(500);
  o.dsize = await page.evaluate(() => (document.querySelector('#detail-body .d-size') || {}).innerText || '');
  // page-aware Zoe from the school page
  o.fabVisible = await page.evaluate(() => { const f = document.getElementById('zoe-fab'); return !f.classList.contains('hidden') && getComputedStyle(f).display !== 'none'; });
  await page.click('#zoe-fab'); await page.waitForTimeout(300);
  o.zoe = await page.evaluate(() => ({ page: document.getElementById('zoe-page').innerText, sugg: [...document.querySelectorAll('#zoe-sugg button')].map(b => b.textContent) }));
  await page.fill('#zoe-in', 'Is this school a good fit for me?'); await page.press('#zoe-in', 'Enter'); await page.waitForTimeout(1200);
  o.aiPage = aiBody && aiBody.ctx && aiBody.ctx.page; o.aiReply = await page.evaluate(() => document.getElementById('zoe-log').innerText.includes('Page-aware answer.'));
  await page.screenshot({ path: `${SHOTS}${label}-zoe.png` });
  await page.click('#zoe-close');
  // page help locally on Costs (no AI call)
  await page.evaluate(() => goto('cost')); await page.waitForTimeout(500); aiBody = null;
  await page.click('#zoe-fab'); await page.waitForTimeout(300);
  o.costSugg = await page.evaluate(() => [...document.querySelectorAll('#zoe-sugg button')].map(b => b.textContent));
  await page.evaluate(() => [...document.querySelectorAll('#zoe-sugg button')].find(b => /How does this page work/.test(b.textContent)).click()); await page.waitForTimeout(400);
  o.costHelp = await page.evaluate(() => { const l = document.getElementById('zoe-log'); return { text: l.lastElementChild.innerText, howto: !!l.querySelector('[data-howto="cost"]') }; }); o.costHelpNoAI = aiBody === null;
  // plain Ask Zoe (tab/banner) is not page-scoped
  await page.click('#zoe-close'); o.plainNoPage = await page.evaluate(() => { zoeOpen(); return document.getElementById('zoe-page').classList.contains('hidden') && _zoePage === null; }); await page.click('#zoe-close');
  // Search: chance badge on every row, filter, sort
  await page.evaluate(() => goto('explore')); await page.waitForTimeout(800);
  o.ex = await page.evaluate(() => { const rows = [...document.querySelectorAll('#exlist .srow')]; const noRate = rows.filter(r => /admit —/.test(r.innerText)).length; return { rows: rows.length, chips: rows.filter(r => r.querySelector('.sn .chip')).length, noRate }; });
  const t0 = Date.now(); await page.selectOption('#ex-ch', 'reach'); await page.waitForTimeout(400); o.exFilterMs = Date.now() - t0;
  o.exReach = await page.evaluate(() => { const c = [...document.querySelectorAll('#exlist .srow .sn .chip')]; return { n: c.length, allReach: c.length > 0 && c.every(x => x.classList.contains('reach') && !x.classList.contains('far')) }; });
  await page.selectOption('#ex-ch', ''); await page.selectOption('#ex-sort2', 'chance'); await page.waitForTimeout(500);
  o.exSort = await page.evaluate(() => [...document.querySelectorAll('#exlist .srow .sn .chip')].slice(0, 5).map(x => x.textContent));
  await page.screenshot({ path: `${SHOTS}${label}-search.png` });
  await page.selectOption('#ex-sort2', 'match');
  // board: rating holds the order + Undo
  await page.evaluate(() => goto('board')); await page.waitForTimeout(600);
  const order = () => page.evaluate(() => [...document.querySelectorAll("#schools .school [data-rate$='|1']")].map(e => e.dataset.rate.split('|')[0]));
  const o1 = await order(); const last = o1[o1.length - 1];
  const sel = `#schools [data-rate="${last}|5"]`; await page.locator(sel).scrollIntoViewIfNeeded(); await page.click(sel); await page.waitForTimeout(900);
  const o2 = await order(); o.held = JSON.stringify(o1) === JSON.stringify(o2);
  o.snack = await page.evaluate(() => { const s = document.getElementById('rate-snack'); return s ? { on: s.classList.contains('on'), text: s.innerText } : null; });
  o.holdNote = await page.evaluate(() => !document.getElementById('board-hold').classList.contains('hidden'));
  o.saved5 = await page.evaluate(id => +(state.ratings.find(r => r.school_id === id && r.user_id === state.me.user_id) || {}).rating, last);
  await page.screenshot({ path: `${SHOTS}${label}-board-hold.png` });
  await page.click('#rate-undo'); await page.waitForTimeout(800);
  o.undone = await page.evaluate(id => { const r = state.ratings.find(r => r.school_id === id && r.user_id === state.me.user_id); return !r || r.rating == null || +r.rating !== 5; }, last);
  o.stillHeld = JSON.stringify(await order()) === JSON.stringify(o1);
  await page.click('#board-resort'); await page.waitForTimeout(400); o.resortHidesNote = await page.evaluate(() => document.getElementById('board-hold').classList.contains('hidden'));
  // leave and come back clears hold
  await page.click(sel); await page.waitForTimeout(800); await page.evaluate(() => { goto('cost'); goto('board'); }); await page.waitForTimeout(400);
  o.holdClearedOnLeave = await page.evaluate(() => _boardHold === null);
  // how-to dialog plays a clip that exists
  await page.evaluate(() => openHowto('board')); await page.waitForTimeout(400);
  o.howto = await page.evaluate(async () => { const v = document.querySelector('#dlg-howto video'); const r = await fetch(v.getAttribute('src')); return { open: document.getElementById('dlg-howto').open, src: v.getAttribute('src'), status: r.status }; });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.picksFacts'] = Array.isArray(o.rec.facts) && o.rec.facts.length === 3 && /Size/.test(o.rec.facts[0]) && /students|no data/.test(o.rec.facts[0]) && /cost/i.test(o.rec.facts[1]) && /Admits/.test(o.rec.facts[2]);
  ok[label + '.picksShowMore'] = o.recGrew === true || o.recGrew === 'n/a';
  ok[label + '.detailSize'] = /[\d,]+ students · Large/.test(o.dsize);
  ok[label + '.fabOnEveryScreen'] = o.fabVisible;
  ok[label + '.zoeKnowsSchool'] = /Asking about/.test(o.zoe.page) && o.zoe.sugg.some(s => /this school/.test(s)) && o.aiPage && o.aiPage.view === 'detail' && o.aiPage.school && o.aiPage.school.size && o.aiReply;
  ok[label + '.zoePageHelpLocal'] = o.costSugg.some(s => /likely cost/i.test(s)) && /Costs estimates/.test(o.costHelp.text) && o.costHelp.howto && o.costHelpNoAI;
  ok[label + '.plainZoeUnscoped'] = o.plainNoPage;
  ok[label + '.ratingHoldsOrder'] = o.held && o.holdNote && o.saved5 === 5 && o.snack && o.snack.on && /You rated/.test(o.snack.text);
  ok[label + '.undo'] = o.undone && o.stillHeld && o.resortHidesNote && o.holdClearedOnLeave;
  ok[label + '.howtoClip'] = o.howto.open && o.howto.status === 200;
  ok[label + '.searchChance'] = o.ex.rows > 0 && o.ex.chips + o.ex.noRate === o.ex.rows && o.exReach.allReach && o.exSort.every(t => /Likely/.test(t));
  ok[label + '.noErrors'] = !o.errors.length;
}
// signed-out: landing video + tour-once flag
{ const b = await launch(); const { page, log } = await newPage(b, { width: 390, height: 844 }, {});
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.addInitScript(() => { window.__SIGNED_OUT = true; });
  const html = fs.readFileSync(APP + 'index.html', 'utf8');
  ok['landing.videoSection'] = /id="lnd-video"[\s\S]{0,600}\/media\/tutorial\.mp4/.test(html);
  ok['landing.tourOnceAfterSignup'] = /zc_welcome_tour/.test(html) && /localStorage\.removeItem\(["']zc_welcome_tour["']\)|lsDel\(["']welcome_tour/.test(html);
  ok['media.tutorialExists'] = fs.existsSync(APP + 'media/tutorial.mp4');
  ok['media.howtoClips'] = ['today','board','recommends','profile','cost','deadlines','trip','talk','journey','memories','decide','zoe','report'].every(k => fs.existsSync(APP + `media/howto/${k}.mp4`) && fs.existsSync(APP + `media/howto/${k}.jpg`));
  await b.close(); }
srv.close();
const allPass = Object.values(ok).every(Boolean);
fs.writeFileSync(new URL('./release9-result-2026-10-12.json', import.meta.url), JSON.stringify({ ok, R }, null, 1));
console.log(JSON.stringify(ok, null, 1)); console.log(JSON.stringify({ allPass }));
