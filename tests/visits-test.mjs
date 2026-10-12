// #78 Trips rethought: shared campus visits — plan with a date picker, change date, tour booked, cancel (two taps),
// road trips form themselves, past visits (any school) with stars, the old one-device trip list moves up, and
// device-only visit notes move to the family. Plus: same-day rounds merge; checklist items read as tick boxes.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f78/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'); const DLF = fs.readFileSync('/home/claude/zoescolleges-data/deadlines-2026-27.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8951);
const ymd = n => { const d = new Date(Date.now() + n * 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DLF }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|\.netlify\/functions/, r => r.abort());
  await page.goto('http://localhost:8951/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me && state.family, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  // the old one-device trip list + a device-only visit note
  await page.evaluate(async () => { localStorage.setItem(_tripKey('zc_trip'), JSON.stringify(['sc-166683', 'sc-164988'])); localStorage.setItem(_tripKey('zc_tripplan'), JSON.stringify({ 'sc-166683': ['🍽 Food Flour Bakery'] }));
    lsSet('visits', { 'college-of-charleston': { date: '2026-04-12', notes: 'Loved the oaks', rating: 5 } }); window.__writes.length = 0; await loadVisits(); goto('trip'); });
  await page.waitForTimeout(500);
  o.migrated = await page.evaluate(() => ({ wish: [...document.querySelectorAll('#trip-out .tv-wrow .tv-name')].map(x => x.textContent), past: [...document.querySelectorAll('#trip-out .tv-past .pv-name')].map(x => x.textContent),
    dbVisits: window.__writes.filter(w => w.table === 'visits').map(w => w.p.school_id), todo: stopPlan('sc-166683'), oldList: localStorage.getItem(_tripKey('zc_trip')) }));
  await page.screenshot({ path: `/tmp/claude-0/f78/${label}-1.png`, fullPage: true });
  // date picker on a "not scheduled" row -> Upcoming
  o.dateInput = await page.evaluate(() => { const i = document.querySelector('#trip-out [data-tvdate="sc-166683"]'); return i ? { type: i.type, min: i.min } : null; });
  await page.fill('#trip-out [data-tvdate="sc-166683"]', ymd(10)); await page.dispatchEvent('#trip-out [data-tvdate="sc-166683"]', 'change'); await page.waitForTimeout(300);
  await page.fill('#trip-out [data-tvdate="sc-164988"]', ymd(11)); await page.dispatchEvent('#trip-out [data-tvdate="sc-164988"]', 'change'); await page.waitForTimeout(300);
  o.roadTrip = await page.evaluate(() => ({ trips: document.querySelectorAll('#trip-out .tv-trip').length, head: (document.querySelector('#trip-out .tv-trip-h') || {}).textContent || '', cards: document.querySelectorAll('#trip-out .tv-trip .tv-card').length,
    saved: getVisits()['sc-166683'] && getVisits()['sc-166683'].date }));
  // tour booked
  await page.check('#trip-out [data-tvbooked="sc-166683"]'); await page.waitForTimeout(300);
  o.booked = await page.evaluate(() => ({ v: getVisits()['sc-166683'].booked, txt: (document.querySelector('#trip-out [data-tv="sc-166683"] .tv-meta') || {}).textContent || '' }));
  // change the date: far away -> the road trip splits
  await page.fill('#trip-out [data-tvdate="sc-164988"]', ymd(30)); await page.dispatchEvent('#trip-out [data-tvdate="sc-164988"]', 'change'); await page.waitForTimeout(300);
  o.split = await page.evaluate(() => ({ trips: document.querySelectorAll('#trip-out .tv-trip').length, singles: document.querySelectorAll('#trip-out .tv-single').length }));
  // cancel = two taps
  await page.click('#trip-out [data-tv="sc-164988"] [data-tvcancel]'); await page.waitForTimeout(150);
  o.armed = await page.evaluate(() => (document.querySelector('#trip-out [data-tv="sc-164988"] [data-tvcancel]') || {}).textContent);
  await page.click('#trip-out [data-tv="sc-164988"] [data-tvcancel]'); await page.waitForTimeout(300);
  o.cancelled = await page.evaluate(() => !getVisits()['sc-164988'] && !document.querySelector('#trip-out [data-tv="sc-164988"]') && window.__writes.some(w => w.table === 'visits' && w.op === 'delete'));
  // plan a visit with the dialog
  await page.click('#tv-plan'); await page.waitForTimeout(200);
  await page.fill('#pvd-school', 'University of Vermont'); await page.fill('#pvd-date', ymd(12)); await page.check('#pvd-booked');
  o.planDlg = await page.evaluate(() => ({ title: document.getElementById('pvd-h').textContent, starsHidden: document.querySelector('#dlg-pastvisit [data-pvmode="past"]').classList.contains('hidden'), min: document.getElementById('pvd-date').min }));
  await page.click('#pvd-save'); await page.waitForTimeout(300);
  o.planned = await page.evaluate(() => { const v = getVisits()['university-of-vermont']; return v && { date: v.date, booked: v.booked, who: (v.who || []).length }; });
  // a past visit at a school that isn't on the board
  await page.click('#tv-past'); await page.waitForTimeout(200);
  await page.fill('#pvd-school', 'Temple University'); await page.fill('#pvd-date', '2026-03-20');
  await page.click('#pvd-stars [data-s="4"]'); await page.fill('#pvd-note', 'Big city energy, great food trucks');
  await page.click('#pvd-save'); await page.waitForTimeout(300);
  o.past = await page.evaluate(() => ({ v: getVisits()['temple-university'], row: [...document.querySelectorAll('#trip-out .tv-past .pv-name')].map(x => x.textContent), onBoard: state.schools.some(s => s.school_id === 'temple-university'),
    boardBtn: !!document.querySelector('#trip-out [data-pv-board="temple-university"]') }));
  // inline rating on a past visit
  await page.click('#trip-out [data-tvrate="college-of-charleston|3"]'); await page.waitForTimeout(200);
  o.rated = await page.evaluate(() => getVisits()['college-of-charleston'].rating);
  // a future date in the past-visit dialog is refused
  await page.click('#tv-past'); await page.waitForTimeout(150); await page.fill('#pvd-school', 'Clemson University'); await page.fill('#pvd-date', ymd(5)); await page.click('#pvd-save'); await page.waitForTimeout(150);
  o.futurePast = await page.evaluate(() => document.getElementById('pvd-msg').textContent); await page.click('#pvd-cancel');
  await page.screenshot({ path: `/tmp/claude-0/f78/${label}-2.png`, fullPage: true });
  // journey, board sort, badge, old callers
  o.journey = await page.evaluate(() => journeyEvents().filter(e => /^Visited /.test(e.h)).map(e => e.h));
  o.badge = await page.evaluate(() => { gotoGroup('plan'); return (document.querySelector('#subnav [data-nav="trip"]') || {}).textContent; });
  o.oldApi = await page.evaluate(() => { const before = inTrip('sc-217882'); const on = toggleTrip('sc-217882'); const off = toggleTrip('sc-217882'); return { before, on, off, trip: [...getTrip()] }; });
  // deadlines: same-day rounds are one line; checklist items are tick boxes
  o.dl = await page.evaluate(() => ({ uvm: deadlineList(catInfo('university-of-vermont')).map(x => x.kind + ' ' + x.date.toISOString().slice(0, 10)), cofc: deadlineList(catInfo('college-of-charleston')).map(x => x.kind) }));
  await page.evaluate(() => goto('deadlines')); await page.waitForTimeout(400);
  o.chk = await page.evaluate(() => ({ boxes: document.querySelectorAll('#v-deadlines .dl-pill[role="checkbox"] .dl-box').length, head: (document.querySelector('#v-deadlines .dl-cl-h') || {}).textContent || '' }));
  await page.evaluate(() => goto('trip')); await page.waitForTimeout(300);
  o.audit = await audit(page, '#v-trip'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.oldTripListMoves'] = o.migrated.wish.length === 2 && o.migrated.dbVisits.includes('sc-166683') && o.migrated.oldList === '[]' && o.migrated.todo.length === 1;
  ok[label + '.deviceVisitMovesUp'] = o.migrated.past.some(n => /Charleston/.test(n)) && o.migrated.dbVisits.includes('college-of-charleston');
  ok[label + '.realDatePicker'] = o.dateInput && o.dateInput.type === 'date' && o.dateInput.min === ymd(0);
  ok[label + '.roadTripForms'] = o.roadTrip.trips === 1 && o.roadTrip.cards === 2 && /Road trip/.test(o.roadTrip.head) && o.roadTrip.saved === ymd(10);
  ok[label + '.tourBooked'] = o.booked.v === true && /Tour booked/.test(o.booked.txt);
  ok[label + '.changeDateSplits'] = o.split.trips === 0 && o.split.singles === 2;
  ok[label + '.cancelTwoTaps'] = /again/.test(o.armed) && o.cancelled;
  ok[label + '.planDialog'] = /Plan a visit/.test(o.planDlg.title) && o.planDlg.starsHidden && o.planDlg.min === ymd(0) && o.planned && o.planned.date === ymd(12) && o.planned.booked === true && o.planned.who === 2;
  ok[label + '.pastVisitAnySchool'] = o.past.v && o.past.v.past && o.past.v.rating === 4 && /food trucks/.test(o.past.v.notes) && o.past.row.includes('Temple University') && !o.past.onBoard && o.past.boardBtn;
  ok[label + '.rateInline'] = o.rated === 3;
  ok[label + '.pastRefusesFuture'] = /future/.test(o.futurePast);
  ok[label + '.journeyShowsVisits'] = o.journey.some(h => /Temple/.test(h)) && o.journey.some(h => /Charleston/.test(h));
  ok[label + '.badgeCounts'] = /Trips · 2/.test(o.badge || '');
  ok[label + '.oldButtonsStillWork'] = o.oldApi.before === false && o.oldApi.on === true && o.oldApi.off === false && !o.oldApi.trip.includes('sc-217882');
  ok[label + '.sameDayRoundsMerge'] = o.dl.uvm.some(k => /Early Decision I or Early Action 2026-11-01|Early Decision or Early Action 2026-11-01/.test(k)) && o.dl.uvm.length === 2 && o.dl.cofc.length === 2;
  ok[label + '.checklistLooksTickable'] = o.chk.boxes > 0 && /Application checklist/.test(o.chk.head);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX; ok[label + '.noBadText'] = !o.audit.bad.length;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(Object.fromEntries(Object.entries(R.phone || {}).filter(([k]) => !['audit'].includes(k))), null, 0).slice(0, 2500)); console.log(JSON.stringify(ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./visits-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
