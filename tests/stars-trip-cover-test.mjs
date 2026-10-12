// Oct 12: half stars (double-click a star), Trip button teal (planned) / grey (visited), board picture is the official
// photo unless the family picks one of theirs in Memories. Run: node tests/stars-trip-cover-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/fstc/site', SHOTS = '/tmp/claude-0/fstc/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const PNG = 'data:image/png;base64,' + fs.readFileSync('/tmp/claude-0/t1.png').toString('base64');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8832);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['desktop-dark', { width: 1280, height: 900 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|wikimedia/, r => r.abort());
  await page.goto('http://localhost:8832/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && state.schools && state.schools.length > 2, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = {};
  const ids = await page.evaluate(() => state.schools.map(s => s.school_id));
  const [past, soon, plain] = ids;
  // visits: one past, one upcoming
  await page.evaluate(([past, soon]) => { const d = n => { const x = new Date(Date.now() + n * 864e5); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
    const a = getVisit(past); a.date = d(-5); saveVisit(past, a); const c = getVisit(soon); c.date = d(6); saveVisit(soon, c); goto('board'); }, [past, soon]);
  await page.waitForTimeout(700);
  const btn = id => page.evaluate(id => { const e = document.querySelector(`#schools [data-trip="${CSS.escape(id)}"]`); return e ? { cls: e.className, text: e.textContent.trim(), color: getComputedStyle(e).color } : null; }, id);
  o.pastBtn = await btn(past); o.soonBtn = await btn(soon); o.plainBtn = await btn(plain);
  // stars on the third school: double-click the 5th = 4.5, then single-click the 3rd = 3
  const sel = n => `#schools [data-rate="${plain}|${n}"]`;
  await page.locator(sel(5)).first().scrollIntoViewIfNeeded(); await page.dblclick(sel(5)); await page.waitForTimeout(900);
  o.afterDbl = await page.evaluate(([sid]) => ({ saved: (state.ratings.find(r => r.school_id === sid && r.user_id === state.me.user_id) || {}).rating, half: document.querySelector(`#schools [data-rate="${sid}|5"]`).classList.contains('half'), on4: document.querySelector(`#schools [data-rate="${sid}|4"]`).classList.contains('on'), hint: !!document.querySelector('#schools .half-hint'), num: (document.querySelector('#schools .half-n') || {}).textContent }), [plain]);
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  await page.click(sel(3)); await page.waitForTimeout(900);
  o.afterClick = await page.evaluate(([sid]) => ({ saved: (state.ratings.find(r => r.school_id === sid && r.user_id === state.me.user_id) || {}).rating, ups: window.__writes.filter(w => w.table === 'ratings').map(w => w.p.rating) }), [plain]);
  // cover: a family photo exists but the board keeps the official photo until picked
  await page.evaluate(async ([sid, img]) => { BACKEND.photos = false; lsSet('photos', [{ id: 'ls-c1', school_id: sid, user_id: state.me.user_id, data: img, caption: 'ours', created_at: new Date().toISOString() }]); await loadPhotos(); goto('board'); }, [past, PNG]);
  await page.waitForTimeout(600);
  const tag = id => page.evaluate(id => { const card = document.querySelector(`#schools [data-trip="${CSS.escape(id)}"]`)?.closest('.school'); return card ? !!card.querySelector('.cover-tag') : null; }, id);
  o.coverDefault = await tag(past);
  await page.evaluate(() => goto('memories')); await page.waitForTimeout(500);
  await page.click('.mem-ph[data-ph="ls-c1"] [data-cover]'); await page.waitForTimeout(400);
  o.coverNote = await page.evaluate(() => (document.querySelector('.mem-note') || {}).textContent || '');
  await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
  o.coverPicked = await tag(past);
  o.stillNotApplying = await page.evaluate(sid => schoolStage(sid) !== 'applying', past);
  await page.evaluate(() => goto('memories')); await page.waitForTimeout(400); await page.click('.mem-ph[data-ph="ls-c1"] [data-cover]'); await page.waitForTimeout(300);
  await page.evaluate(() => goto('board')); await page.waitForTimeout(400); o.coverBack = await tag(past);
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.pastTripGrey'] = /past/.test(o.pastBtn?.cls || '') && /Visited/.test(o.pastBtn?.text || '');
  ok[label + '.upcomingTripTeal'] = /\bon\b/.test(o.soonBtn?.cls || '') && /Trip/.test(o.soonBtn?.text || '') && o.soonBtn.color !== o.pastBtn.color;
  ok[label + '.plainTrip'] = /🗺 Trip/.test(o.plainBtn?.text || '');
  ok[label + '.doubleClickHalf'] = +o.afterDbl.saved === 4.5 && o.afterDbl.half && o.afterDbl.on4 && o.afterDbl.hint && o.afterDbl.num === '4.5';
  ok[label + '.singleClickWhole'] = +o.afterClick.saved === 3 && !o.afterClick.ups.includes(5) && !o.afterClick.ups.includes(null);
  ok[label + '.officialPhotoByDefault'] = o.coverDefault === false;
  ok[label + '.pickYourPhoto'] = o.coverPicked === true && /now shows your photo/.test(o.coverNote) && o.stillNotApplying;
  ok[label + '.backToOfficial'] = o.coverBack === false;
  ok[label + '.noErrors'] = !o.errors.length;
}
srv.close();
const allPass = Object.values(ok).every(Boolean);
fs.writeFileSync(new URL('./stars-trip-cover-result-2026-10-12.json', import.meta.url), JSON.stringify({ ok, R }, null, 1));
console.log(JSON.stringify(ok, null, 1), allPass); console.log(JSON.stringify({ allPass }));
