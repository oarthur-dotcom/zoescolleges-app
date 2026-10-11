// #47 Memories as its own tab + Trips on its own; sample reel/video; add photos; family takes; share-your-reel. Run: node tests/memories-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f47/site', SHOTS = '/tmp/claude-0/f47/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8809);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/thumb\.wikimedia\.org/, r => r.fulfill({ contentType: 'image/png', body: fs.readFileSync('/tmp/claude-0/t1.png'), headers: { 'access-control-allow-origin': '*' } }));
  await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8809/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(900);
  const o = {};
  o.nav = await page.evaluate(() => [...document.querySelectorAll('#appnav .navbtn')].map(x => x.textContent.trim()));
  o.sheet = await page.evaluate(() => [...document.querySelectorAll('#tb-sheet .tbs b')].map(x => x.textContent));
  await page.evaluate(() => { localStorage.removeItem(_tripKey ? 'x' : 'x'); state.photos = []; goto('memories'); }); await page.waitForTimeout(500);
  o.empty = await page.evaluate(() => ({ steps: document.querySelectorAll('.mem-steps>div').length, strip: document.querySelectorAll('.mem-sample-strip span').length, play: !!document.getElementById('mem-sample-play'), playHidden: document.getElementById('mem-play').classList.contains('hidden') }));
  await page.screenshot({ path: `${SHOTS}${label}-empty.png` });
  await page.click('#mem-sample-play'); await page.waitForTimeout(500);
  o.player = await page.evaluate(() => ({ open: document.getElementById('player').classList.contains('open'), cap: document.getElementById('player-cap').innerText }));
  await page.click('#player-close'); await page.waitForTimeout(200);
  await page.click('#mem-sample-video'); await page.waitForTimeout(1500);
  o.film = await page.evaluate(() => { const ov = document.querySelector('.film-ov'); const r = !!(ov && ov.querySelector('canvas')); if (ov) ov.querySelector('.film-x').click(); return r; });
  // add two photos to College of Charleston
  await page.evaluate(() => { BACKEND.photostore = false; BACKEND.photos = false; });   // the fake backend has no file storage: use the on-device path
  await page.click('#mem-first'); await page.waitForTimeout(200);
  await page.selectOption('#mem-add-school', 'college-of-charleston'); await page.fill('#mem-add-cap', 'Randolph Hall');
  await page.setInputFiles('#mem-add-file', ['/tmp/claude-0/t1.png', '/tmp/claude-0/t2.png']); await page.waitForTimeout(1500);
  o.addMsg = await page.textContent('#mem-add-msg');
  o.visits = await page.evaluate(() => [...document.querySelectorAll('.mem-visit')].map(v => v.innerText.replace(/\s+/g, ' ').slice(0, 220)));
  await page.screenshot({ path: `${SHOTS}${label}-visits.png`, fullPage: false });
  // share: give the photos cloud ids (as after sync), then send with all three boxes
  await page.evaluate(() => { state.photos = state.photos.map((p, i) => ({ ...p, id: 'cloud-' + i })); _reelShare = null; renderMemories(); }); await page.waitForTimeout(400);
  await page.click('#mem-share-go'); await page.waitForTimeout(200);
  await page.click('#share-send'); await page.waitForTimeout(150); o.noConsentMsg = await page.textContent('#share-msg');
  for (const c of await page.$$('[data-consent]')) await c.check();
  await page.click('#share-send'); await page.waitForTimeout(600);
  o.shareWrite = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'reel_submissions' && x.op === 'insert').pop(); return w && { n: w.p.photo_ids.length, status: w.p.status, show: w.p.show_as, consent: Object.keys(w.p.consent).sort().join(',') }; });
  o.thanks = await page.evaluate(() => (document.querySelector('#mem-share .msg.ok') || {}).textContent || '');
  // Trips stands alone
  await page.evaluate(() => goto('trip')); await page.waitForTimeout(300);
  o.trips = await page.evaluate(() => ({ title: document.querySelector('#v-trip h1').textContent, back: !!document.getElementById('trip-back') }));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.memoriesInNav'] = o.nav.includes('📸 Memories') && o.sheet.includes('Memories');
  ok[label + '.emptyStateTeaches'] = o.empty.steps === 3 && o.empty.strip === 6 && o.empty.play && o.empty.playHidden;
  ok[label + '.sampleReelCredited'] = o.player.open && /Photo: .*Wikimedia Commons/.test(o.player.cap);
  ok[label + '.sampleVideo'] = o.film;
  ok[label + '.addSeveralPhotos'] = /Added 2 photos/.test(o.addMsg) && o.visits.length === 1 && /College of Charleston/.test(o.visits[0]) && /2 photos/.test(o.visits[0]);
  ok[label + '.familyTakesShown'] = /Loved the campus/.test(o.visits[0]);
  ok[label + '.shareNeedsConsent'] = /all three boxes/.test(o.noConsentMsg);
  ok[label + '.shareSendsPending'] = !!o.shareWrite && o.shareWrite.n === 2 && o.shareWrite.status === 'pending' && o.shareWrite.show === 'anonymous' && o.shareWrite.consent === 'at,own,people,show' && /in review/.test(o.thanks);
  ok[label + '.tripsStandsAlone'] = /Trips/.test(o.trips.title) && !o.trips.back;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./memories-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
