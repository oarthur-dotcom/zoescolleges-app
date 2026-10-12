// #81: school stages (Exploring → Visiting → Applying → Deciding) + deadlines filtered by stage.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f81/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'); const DLF = fs.readFileSync('/home/claude/zoescolleges-data/deadlines-2026-27.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8963);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DLF }));
  await page.goto('http://localhost:8963/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me && state.family, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  await page.evaluate(() => { try { localStorage.removeItem(lsKey('dlStages')); } catch (e) {} state.schools.forEach(s => { s.checklist = {}; if (s.app_status === 'applied') s.app_status = 'planning'; }); goto('deadlines'); }); await page.waitForTimeout(400);
  const ids = await page.evaluate(() => state.schools.map(s => s.school_id));
  o.start = await page.evaluate(() => ({ cards: document.querySelectorAll('#dl-out .dl-row').length, bar: [...document.querySelectorAll('#dl-out [data-dlstage]')].map(x => x.textContent.trim()), hint: !!document.querySelector('.dl-sb-hint') }));
  // mark one school "We're applying" -> page focuses on it
  await page.click(`#dl-out [data-dlapply="${ids[0]}"]`); await page.waitForTimeout(400);
  o.focused = await page.evaluate(id => ({ cards: document.querySelectorAll('#dl-out .dl-row').length, stage: schoolStage(id), pill: (document.querySelector('#dl-out .st-pill') || {}).textContent, saved: window.__writes.filter(w => w.table === 'family_schools' && w.p && w.p.checklist && w.p.checklist._stage === 'applying').length }), ids[0]);
  // show Exploring too
  await page.click('#dl-out [data-dlstage="exploring"]'); await page.waitForTimeout(300);
  o.more = await page.evaluate(() => document.querySelectorAll('#dl-out .dl-row').length);
  // visiting is automatic
  o.visiting = await page.evaluate(id => { planVisit(id); return schoolStage(id); }, ids[1]);
  // deciding follows the application status
  o.deciding = await page.evaluate(id => { const c = getChecklist(id); c['Submitted'] = true; setChecklist(id, c); return schoolStage(id); }, ids[2]);
  // undo applying
  await page.evaluate(() => { try { localStorage.removeItem(lsKey('dlStages')); } catch (e) {} renderDeadlines(); }); await page.waitForTimeout(200);
  o.boardPill = await page.evaluate(() => { goto('board'); return [...document.querySelectorAll('#schools .st-pill')].map(x => x.textContent); });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.allShownAtFirst'] = o.start.cards === ids.length && o.start.bar.length === 4 && o.start.hint;
  ok[label + '.applyingFocuses'] = o.focused.stage === 'applying' && o.focused.cards === 1 && o.focused.saved >= 1;
  ok[label + '.filterAddsStages'] = o.more > 1;
  ok[label + '.visitingAutomatic'] = o.visiting === 'visiting';
  ok[label + '.decidingAfterSubmit'] = o.deciding === 'deciding';
  ok[label + '.boardShowsStage'] = o.boardPill.some(t => /Applying|Visiting/.test(t));
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.phone && { start: R.phone.start, focused: R.phone.focused, more: R.phone.more, v: R.phone.visiting, d: R.phone.deciding, pills: R.phone.boardPill })); console.log(JSON.stringify(ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./stages-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
