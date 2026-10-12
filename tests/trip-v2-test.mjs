// #69 Step 5: trip planner — category place search through our server, real admissions links, clear on-campus mode, readable inputs.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f69/site', SHOTS = '/tmp/claude-0/f69/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'); const VL = fs.readFileSync('/home/claude/zoescolleges-data/visit-links.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8906);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/jsdelivr.*visit-links\.json/, r => r.fulfill({ contentType: 'application/json', body: VL }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|overpass/, r => r.abort());
  let placeCalls = [], placeMode = 'ok';
  await page.route('**/.netlify/functions/places-near**', async r => { placeCalls.push(r.request().url()); await r.fulfill({ contentType: 'application/json', body: JSON.stringify(placeMode === 'ok' ? { places: [{ name: 'Muddy Waters', mi: 0.3, kind: 'cafe' }, { name: 'Radio Bean', mi: 0.6, kind: 'music venue' }] } : { busy: true }) }); });
  await page.goto('http://localhost:8906/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0 && state.visitLinks, null, { timeout: 60000 }); await page.waitForTimeout(500);
  const o = {};
  await page.evaluate(() => { ['university-of-vermont'].forEach(id => { if (!getTrip().has(id)) toggleTrip(id); }); goto('trip'); });
  await page.waitForTimeout(400); await page.selectOption('#trip-days', '1'); await page.click('#trip-build'); await page.waitForTimeout(2500);
  // make "today" the visit day
  await page.evaluate(() => { tripBuilt.start = new Date(); tripBuilt.start.setHours(9, 0, 0, 0); renderTripOut(); }); await page.waitForTimeout(400);
  o.stop = await page.evaluate(() => { const st = document.querySelector('.trip-stop'); const links = [...st.querySelectorAll('.ts-visit a')].map(a => ({ t: a.textContent.trim(), h: a.href })); const btn = st.querySelector('[data-visitkit]');
    return { links, onCampus: btn.textContent.trim(), primary: btn.classList.contains('primary'), hint: st.querySelector('.ts-onsite').innerText, cats: [...st.querySelectorAll('.near-cat')].map(x => x.textContent), ph: st.querySelector('.plan-in').placeholder,
      input: (() => { const i = st.querySelector('.plan-in'); const cs = getComputedStyle(i); return { fg: cs.color, bg: cs.backgroundColor, pad: cs.paddingTop }; })() }; });
  await page.click('.near-cat[data-cat="coffee"]'); await page.waitForTimeout(500);
  o.chips = await page.evaluate(() => [...document.querySelectorAll('.near-chip')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  o.call = placeCalls[0] || '';
  await page.click('.near-chip'); await page.waitForTimeout(300); o.plan = await page.evaluate(() => [...document.querySelectorAll('.plan-item')].map(x => x.textContent.replace('✕', '').trim()));
  await page.fill('.plan-in', 'Dinner at Leunig\'s'); await page.click('.plan-form button'); await page.waitForTimeout(300);
  o.plan2 = await page.evaluate(() => [...document.querySelectorAll('.plan-item')].map(x => x.textContent.replace('✕', '').trim()));
  placeMode = 'busy'; await page.click('.near-cat[data-cat="music"]'); await page.waitForTimeout(500); o.busy = await page.evaluate(() => (document.querySelector('.near-fallback') || {}).innerText || '');
  await page.evaluate(() => document.querySelector('.trip-stop').scrollIntoView()); await page.screenshot({ path: `${SHOTS}${label}-stop.png` });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close(); R[label] = o;
  const contrast = (fg, bg) => { const L = c => { const [r, g, b2] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b2; }; const a = L(fg), c2 = L(bg); return (Math.max(a, c2) + .05) / (Math.min(a, c2) + .05); };
  ok[label + '.bookVisitIsOfficial'] = o.stop.links[0].h === 'https://www.uvm.edu/admissions' && /Book a visit/.test(o.stop.links[0].t) && !o.stop.links.some(l => /google\.com\/search.*admissions/.test(l.h));
  ok[label + '.onCampusIsClear'] = /I'm on campus/.test(o.stop.onCampus) && o.stop.primary && /Visit day/.test(o.stop.hint);
  ok[label + '.categoryButtons'] = o.stop.cats.join('|') === '🍽 Food|☕ Coffee|🛏 Stay|📍 Things to do|🎵 Music & arts|🌲 Outdoors';
  ok[label + '.searchThroughServer'] = /cat=coffee/.test(o.call) && o.chips.length === 2 && /Muddy Waters 0.3 mi/.test(o.chips[0]) && o.plan.some(p => /Muddy Waters/.test(p));
  ok[label + '.addYourOwnLabeled'] = /Add your own stop/.test(o.stop.ph) && o.plan2.some(p => /Leunig/.test(p));
  ok[label + '.inputReadable'] = contrast(o.stop.input.fg, o.stop.input.bg) >= 7 && parseFloat(o.stop.input.pad) >= 6;
  ok[label + '.honestWhenBusy'] = /slow to load/.test(o.busy) && /Open music venues on the map/.test(o.busy);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./trip-v2-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
