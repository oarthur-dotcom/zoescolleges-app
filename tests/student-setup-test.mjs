// #64 A parent sets up the student before they join; the profile moves to the student's account. Run: node tests/student-setup-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f64/site', SHOTS = '/tmp/claude-0/f64/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8864);
const FID = 'ffffffff-ffff-ffff-ffff-ffffffffffff', UID2 = '22222222-2222-2222-2222-222222222222';
const R = {}, ok = {};
const open = async (b, vp, init, dark) => { const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' }); await page.addInitScript(init || '');
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8864/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800); return { page, log }; };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const o = {};
  // A. Parent, no student yet
  { const { page, log } = await open(b, vp, 'window.__NOSTUDENT=true;', dark);
    o.card1 = await page.evaluate(() => (document.querySelector('#td-student .ns-card') || {}).innerText || '');
    o.firstCard = await page.evaluate(() => { const c = document.querySelector('#v-today .td-card'); return c ? c.className : ''; });
    await page.click('#ss-save'); await page.waitForTimeout(200); o.emptyMsg = await page.textContent('#ss-msg');
    await page.fill('#ss-name', 'Zoe'); await page.check('#ss-copy'); await page.click('#ss-save'); await page.waitForTimeout(600);
    o.insert = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'pending_students' && x.op === 'insert').pop(); return w && { name: w.p.display_name, gpa: w.p.profile.gpa, major: w.p.profile.major, hasUid: 'user_id' in w.p.profile }; });
    o.card2 = await page.evaluate(() => (document.querySelector('#td-student .ns-card') || {}).innerText || '');
    await page.screenshot({ path: `${SHOTS}${label}-today.png` });
    await page.click('[data-ns-step="grades"]'); await page.waitForTimeout(600);
    o.profile = await page.evaluate(() => ({ view: currentView, scope: document.getElementById('profile-scope').innerText, title: (document.getElementById('pf-form-title') || {}).textContent || '', summary: (document.getElementById('pf-summary') || {}).innerText || '' }));
    await page.evaluate(() => { pfEdit = true; renderProfileView(); renderProfile(); }); await page.waitForTimeout(300);
    o.formGpa = await page.inputValue('#pf-gpa');
    await page.evaluate(() => { document.getElementById('pf-gpa').value = '3.9'; return saveProfileForm(); }); await page.waitForTimeout(600);
    o.saved = await page.evaluate(() => ({ upd: window.__writes.filter(x => x.table === 'pending_students' && x.op === 'update').map(x => x.p.profile && x.p.profile.gpa), ownWrites: window.__writes.filter(x => x.table === 'profiles').length, student: studentProfile() && studentProfile().gpa, own: state.profiles[state.me.user_id].gpa, report: reportStudentName(), first: studentFirst() }));
    await page.screenshot({ path: `${SHOTS}${label}-profile.png` });
    o.audit = await audit(page, 'body'); o.errA = log.pageerr; }
  // B. Student joins: pending profile moves to her account, pending row removed
  { const init = `window.__ASSTUDENT=true; window.__PENDING=${JSON.stringify({ family_id: FID, display_name: 'Zoe', profile: { gpa: '3.9', sat: '1350', major: 'Biology', test_optional: true, activities: [{ name: 'Soccer', category: 'Athletics', tier: 3 }] } })};`;
    const { page, log } = await open(b, vp, init, dark);
    o.claim = await page.evaluate((u2) => ({ up: window.__writes.filter(x => x.table === 'profiles' && x.op === 'upsert').map(x => ({ uid: x.p.user_id, gpa: x.p.gpa, acts: (x.p.activities || []).length, to: x.p.test_optional })), del: window.__writes.filter(x => x.table === 'pending_students' && x.op === 'delete').length, pending: state.pending, card: !!document.querySelector('.td-student'), mine: state.profiles[u2] && state.profiles[u2].gpa, to: state.profiles[u2] && state.profiles[u2].testOptional }), UID2);
    o.errB = log.pageerr; }
  // C. Student already in the family: no card
  { const { page, log } = await open(b, vp, '', dark); o.noCard = await page.evaluate(() => !document.querySelector('.td-student')); o.errC = log.pageerr; }
  await b.close(); R[label] = o;
  ok[label + '.askWhoIsStudent'] = /Add your student/i.test(o.card1) && /ns-card/.test(o.firstCard) && /first name/.test(o.emptyMsg);
  ok[label + '.addStudentCarriesParentEntries'] = o.insert && o.insert.name === 'Zoe' && o.insert.gpa === '3.7' && o.insert.major === 'Biology' && !o.insert.hasUid;
  ok[label + '.waitingCard'] = /Set your priorities/i.test(o.card2) && /Family/.test(o.card2);
  ok[label + '.profileForStudent'] = o.profile.view === 'profile' && /filling this in for Zoe/.test(o.profile.scope) && o.formGpa === '3.7';
  ok[label + '.savesToStudentNotParent'] = o.saved.upd.includes('3.9') && o.saved.ownWrites === 0 && o.saved.student === '3.9' && o.saved.own === '3.7' && o.saved.report === 'Zoe' && o.saved.first === 'Zoe';
  ok[label + '.studentJoinsAndClaims'] = o.claim.up.length === 1 && o.claim.up[0].uid === UID2 && o.claim.up[0].gpa === '3.9' && o.claim.up[0].acts === 1 && o.claim.up[0].to === true && o.claim.del === 1 && !o.claim.pending && o.claim.mine === '3.9';
  ok[label + '.noCardWithStudent'] = o.noCard;
  ok[label + '.noErrors'] = !o.errA.length && !o.errB.length && !o.errC.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./student-setup-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
