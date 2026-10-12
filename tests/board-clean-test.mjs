// #59 Board cleanup; Today is the dashboard. Run: node tests/board-clean-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f59/site', SHOTS = '/tmp/claude-0/f59/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8823);
const R = {}, ok = {};
for (const [label, vp, dark, empty] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true], ['empty-phone', { width: 390, height: 844 }, false, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, { empty }); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8823/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.removeItem('zc_onboard_done'); localStorage.removeItem('zc_howto'); } catch (e) {} goto('today'); }); await page.waitForTimeout(500);
  const o = {};
  o.today = await page.evaluate(() => ({ onboard: !!document.querySelector('#v-today #onboard-guide .ob, #v-today #onboard-guide > *'), howtoInToday: !!document.querySelector('#v-today #howto'), howtoShown: !document.querySelector('#howto').classList.contains('hidden'), cards: document.querySelectorAll('#td-out .td-card').length, nextStep: !!document.querySelector('#v-today .ns-card'), nextStepText: ((document.querySelector('#v-today .ns-card') || {}).innerText || '').slice(0, 200) }));
  await page.screenshot({ path: `${SHOTS}${label}-today.png` });
  await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
  o.board = await page.evaluate(() => { const v = document.querySelector('#v-board'); const top = v.querySelector('#schools .school, #schools .card'); return {
    noOnboard: !v.querySelector('#onboard-guide'), noZoeBanner: !v.querySelector('.zoe-banner'), noCoach: !v.querySelector('#board-coach'), noHowto: !v.querySelector('#howto'), noNextstep: !v.querySelector('#nextstep'),
    firstSchoolTop: top ? Math.round(top.getBoundingClientRect().top + scrollY) : null, sum: (v.querySelector('#balance') || {}).innerText || '', schools: v.querySelectorAll('#schools .school').length,
    controls: ['btn-invite', 'btn-more', 'board-sort', 'view-stacked', 'view-tiles', 'rank-toggle', 'fab-add'].every(id => !!document.getElementById(id)) }; });
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  await page.evaluate(() => goto('today')); await page.waitForTimeout(300);
  if (o.today.howtoShown) { await page.click('#howto-x'); await page.waitForTimeout(200); }
  o.howtoGone = await page.evaluate(() => document.querySelector('#howto').classList.contains('hidden'));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.boardIsJustTheList'] = o.board.noOnboard && o.board.noZoeBanner && o.board.noCoach && o.board.noHowto && o.board.noNextstep && o.board.controls;
  if (!empty) { ok[label + '.schoolsVisibleImmediately'] = o.board.firstSchoolTop !== null && o.board.firstSchoolTop < (label === 'desktop' ? 420 : 520); ok[label + '.oneLineSummary'] = /Likely · .* Target · .* Reach/.test(o.board.sum) && /Family favorite|How this works/.test(o.board.sum); }
  ok[label + '.guidanceOnToday'] = o.today.nextStep && (empty || o.today.cards >= 5);   // #67: one 'next step' card replaced the old guide boxes
  if (empty) ok[label + '.howtoForNewFamilies'] = o.today.nextStep && /Your next step/i.test(o.today.nextStepText);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass, JSON.stringify({ top: R.phone.board.firstSchoolTop, dtop: R.desktop.board.firstSchoolTop, sum: R.phone.board.sum }));
fs.writeFileSync(new URL('./board-clean-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
