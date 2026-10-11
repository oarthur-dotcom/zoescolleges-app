// #36 Activities, Common App style — page test (headless browser, fake backend). Run: node tests/activities-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f36/site', SHOTS = '/tmp/claude-0/f36/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f33/colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8798);
const R = {}, ok = {};
async function run(vp, label, dark) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.goto('http://localhost:8798/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { localStorage.removeItem('activities'); goto('profile'); }); await page.waitForTimeout(500);
  const o = {};
  o.empty = await page.evaluate(() => document.getElementById('pf-acts').innerText.replace(/\s+/g, ' '));
  o.addLabel = await page.evaluate(() => document.getElementById('pf-act-add').textContent);
  const lastSave = () => page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'profiles' && x.op === 'upsert').pop(); return w ? w.p.activities : null; });
  // 1) a varsity sport, all from menus
  await page.click('#pf-act-add'); await page.waitForTimeout(200);
  await page.selectOption('.act-card.open .a-cat', 'Athletics: JV/Varsity'); await page.waitForTimeout(150);
  o.sportIsDropdown = await page.evaluate(() => { const s = document.querySelector('.act-card.open .a-sport'); return s ? s.tagName + ':' + s.options.length : 'missing'; });
  await page.selectOption('.act-card.open .a-sport', 'Rugby');
  await page.selectOption('.act-card.open .a-pos', 'Captain');
  for (const g of ['10', '11', '12']) await page.click(`.act-card.open .a-gr[data-gr="${g}"]`);
  await page.selectOption('.act-card.open .a-hrs', '20'); await page.selectOption('.act-card.open .a-wks', '36');
  await page.selectOption('.act-card.open .a-lvl', '3');
  await page.fill('.act-card.open .a-desc', 'Led warmups; team made the state quarterfinals.');
  o.unsaved = await page.evaluate(() => document.getElementById('pf-savemsg2').textContent);
  await page.screenshot({ path: `${SHOTS}${label}-editing.png`, fullPage: false });
  await page.click('.act-card.open .a-done'); await page.waitForTimeout(400);
  o.afterFirst = await page.evaluate(() => [...document.querySelectorAll('#pf-acts .act-row')].map(r => r.innerText.replace(/\s+/g, ' ')));
  o.saved1 = await lastSave(); o.status1 = await page.evaluate(() => document.getElementById('pf-savemsg2').textContent);
  // 2) a job with nothing typed at all — must still be kept
  await page.click('#pf-act-add'); await page.waitForTimeout(150);
  await page.selectOption('.act-card.open .a-cat', 'Work (Paid)'); await page.selectOption('.act-card.open .a-hrs', '12');
  await page.click('.act-card.open .a-done'); await page.waitForTimeout(400);
  o.saved2 = (await lastSave() || []).map(a => a.name);
  o.addLabel2 = await page.evaluate(() => document.getElementById('pf-act-add').textContent + ' | ' + document.getElementById('pf-act-count').textContent);
  // 3) reorder
  await page.click('#pf-acts .act-row[data-i="1"] .a-up'); await page.waitForTimeout(400);
  o.saved3 = (await lastSave() || []).map(a => a.name);
  // 4) remove
  await page.click('#pf-acts .act-row[data-i="0"] .act-sum'); await page.waitForTimeout(150);
  await page.click('.act-card.open .a-rm'); await page.waitForTimeout(400);
  o.saved4 = (await lastSave() || []).map(a => a.name);
  await page.screenshot({ path: `${SHOTS}${label}-list.png` });
  // 5) old-format entries are mapped (free-text sport, old category)
  o.mapped = await page.evaluate(() => { const p = state.profiles[state.me.user_id]; p.activities = [{ name: 'Varsity soccer', category: 'Athletics: Varsity', sport: 'soccer', tier: 3, yrs: '3', hrs: '10' }, { name: 'Robotics club', category: 'Robotics / Engineering', tier: 4 }]; renderProfile(); return [...document.querySelectorAll('#pf-acts .act-row')].map(r => r.innerText.replace(/\s+/g, ' ')); });
  // 6) 10 max
  o.max = await page.evaluate(() => { for (let i = 0; i < 12; i++) document.getElementById('pf-act-add').click(); return document.querySelectorAll('#pf-acts .act-row, #pf-acts .act-card').length + ' | ' + document.getElementById('pf-act-add').textContent; });
  o.audit = await audit(page, '#pf-acts-card'); o.errors = log.pageerr;
  await b.close(); return o;
}
fs.mkdirSync(SHOTS, { recursive: true });
R.desktop = await run({ width: 1280, height: 900 }, 'desktop');
R.phone = await run({ width: 390, height: 844 }, 'phone');
R.dark = await run({ width: 390, height: 844 }, 'phone-dark', true);
for (const [k, o] of Object.entries(R)) {
  ok[k + '.emptyStateClear'] = /No activities yet/.test(o.empty) && /first activity/.test(o.addLabel);
  ok[k + '.sportIsDropdown'] = /^SELECT:3\d$/.test(o.sportIsDropdown);
  ok[k + '.showsUnsaved'] = /Unsaved/.test(o.unsaved);
  ok[k + '.doneSavesAndCollapses'] = o.afterFirst.length === 1 && /Rugby \(JV\/Varsity\) — Captain/.test(o.afterFirst[0]) && /Gr 10–12 · 20 hr\/wk · 36 wk\/yr/.test(o.afterFirst[0]) && /Saved — 1 activity/.test(o.status1);
  const s1 = (o.saved1 || [])[0] || {};
  ok[k + '.commonAppFieldsSaved'] = s1.sport === 'Rugby' && s1.position === 'Captain' && JSON.stringify(s1.grades) === '["10","11","12"]' && s1.yrs === '3' && s1.hrs === '20' && s1.weeks === '36' && s1.tier === 3 && /quarterfinals/.test(s1.desc) && s1.category === 'Athletics: JV/Varsity';
  ok[k + '.untypedActivityKept'] = JSON.stringify(o.saved2) === '["Rugby (JV/Varsity) — Captain","Work (Paid)"]';
  ok[k + '.addAnotherClear'] = /Add another activity/.test(o.addLabel2) && /2 of 10/.test(o.addLabel2);
  ok[k + '.reorderSaved'] = JSON.stringify(o.saved3) === '["Work (Paid)","Rugby (JV/Varsity) — Captain"]';
  ok[k + '.removeSaved'] = JSON.stringify(o.saved4) === '["Rugby (JV/Varsity) — Captain"]';
  ok[k + '.oldEntriesMapped'] = /Soccer \(JV\/Varsity\)/.test(o.mapped[0]) && /3 yr/.test(o.mapped[0]) && /Robotics/.test(o.mapped[1]);
  ok[k + '.tenMax'] = /^10 \| 10 of 10/.test(o.max);
  ok[k + '.noErrors'] = !o.errors.length; ok[k + '.noSidewaysScroll'] = !o.audit.overflowX; ok[k + '.noBadText'] = !o.audit.bad.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./activities-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
