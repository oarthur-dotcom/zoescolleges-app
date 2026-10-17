// Parents can add/adjust the student's grades; the Grades step goes to the profile (not the share sheet);
// pending grades are never deleted unless they provably landed. Needs: npm i --no-save playwright @supabase/supabase-js@2.45.4
// Run: node tests/parent-edits-student-grades-test.mjs  (CHROME=/path/to/chrome to override the browser; the supabase CDN is served locally)
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const APP = new URL('../', import.meta.url).pathname;
const DATA = process.env.ZC_DATA || path.join(APP, '../zoescolleges-data');
const srv = http.createServer((q, r) => { const f = path.join(APP, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8913);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
async function open() {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(APP + 'node_modules/@supabase/supabase-js/dist/umd/supabase.js') }));
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: fs.existsSync(DATA + '/colleges.json') ? fs.readFileSync(DATA + '/colleges.json') : '{"colleges":[]}' }));
  await page.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })); await page.route(/fonts\.g|cdnjs|openstreetmap|osrm|overpass/, r => r.abort());
  await page.goto('http://localhost:8913/index.html'); await page.waitForFunction(() => typeof saveProfile === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {   // a fake database client that records every write and can be told to fail
    window.__log = []; window.__cfg = { upsertError: null, pendingUpdateRows: [{ family_id: 'f' }], profileRow: null };
    window.__alerts = []; window.alert = m => window.__alerts.push(m);
    const mk = t => { const s = { t, op: null }; const api = {
      select() { if (!s.op) s.op = 'select'; return api; }, upsert(row) { s.op = 'upsert'; window.__log.push({ t, op: 'upsert', row }); return Promise.resolve({ error: window.__cfg.upsertError }); },
      update(v) { s.op = 'update'; s.v = v; return api; }, delete() { s.op = 'delete'; window.__log.push({ t, op: 'delete' }); return api; }, insert() { return Promise.resolve({ error: null }); }, eq() { return api; },
      maybeSingle() { return Promise.resolve({ data: t === 'profiles' ? window.__cfg.profileRow : null, error: null }); },
      then(res) { if (s.op === 'update') { window.__log.push({ t, op: 'update', v: s.v }); return res({ data: window.__cfg.pendingUpdateRows, error: null }); } return res({ data: [], error: null }); } }; return api; };
    sb = { from: mk, rpc: () => Promise.resolve({ error: null }) };
    const GRADES = { gpa: '3.8', sat: '1400' };
    window.__family = (me) => { state.family = { id: 'f', name: 'Arthur Clan' }; state.me = me; state.schools = [{ school_id: 'a' }, { school_id: 'b' }, { school_id: 'c' }]; state.profiles = {}; state.pending = null;
      state.members = [{ user_id: 'dad', role: 'parent', display_name: 'Dad' }, { user_id: 'zoe', role: 'student', display_name: 'Zoe' }]; };
  });
  return { page, errs };
}
// 1. Dad, Zoe already joined, no grades anywhere (exactly production) ------------------------------------------------
{ const { page, errs } = await open();
  const r = await page.evaluate(async () => {
    __family({ user_id: 'dad', role: 'parent', display_name: 'Dad' }); let shares = 0; Object.defineProperty(navigator, 'share', { value: async () => { shares++; }, configurable: true });
    const host = document.createElement('div'); document.body.appendChild(host); host.innerHTML = nextStepHtml(); wireNextStep(host);
    const out = { chips: [...host.querySelectorAll('.ns-chip')].map(c => c.textContent.trim()), cta: host.querySelector('[data-ns-go]').textContent, nudge: (host.querySelector('[data-ns-nudge]') || {}).textContent };
    host.querySelector('[data-ns-step="grades"]').click(); await new Promise(r => setTimeout(r, 400)); out.viewAfterChip = currentView; out.sharesAfterChip = shares;
    out.key = profKey(); out.editing = editingStudentProfile(); out.readOnly = studentReadOnly(); out.h1 = document.getElementById('pf-h1').textContent; out.formTitle = document.getElementById('pf-form-title').textContent;
    out.formHidden = document.getElementById('pf-form-card').classList.contains('hidden');
    document.getElementById('pf-gpa').value = '3.8'; document.getElementById('pf-sat').value = '1400'; document.getElementById('pf-hs').value = 'West High';
    out.saved = await saveProfileForm(); out.writes = window.__log.filter(l => l.op === 'upsert').map(l => ({ t: l.t, user: l.row.user_id, fam: l.row.family_id, gpa: l.row.gpa }));
    out.zoeProfile = (state.profiles.zoe || {}).gpa; out.dadProfile = state.profiles.dad ? 'touched' : 'untouched'; out.alerts = window.__alerts.length;
    return out; });
  ok(r.chips.every(c => !/^\d/.test(c)), 'chips no longer start with a number that reads like a count: ' + r.chips.join(' | '));
  ok(r.cta === 'Add grades', 'the main button says "Add grades", not "Ask Zoe": ' + r.cta);
  ok(/Ask Zoe/.test(r.nudge || ''), 'asking Zoe is still available as a secondary button');
  ok(r.viewAfterChip === 'profile' && r.sharesAfterChip === 0, 'clicking the Grades chip opens the profile, not the share sheet (view=' + r.viewAfterChip + ', shares=' + r.sharesAfterChip + ')');
  ok(r.editing && !r.readOnly && r.key === 'zoe', "a parent's profile screen edits Zoe's profile");
  ok(/Zoe/.test(r.h1) && /Zoe/.test(r.formTitle), 'headings say whose grades these are: ' + r.h1 + ' / ' + r.formTitle);
  ok(r.formHidden === false, 'the entry form is shown (not the read-only "only Zoe can edit" message)');
  ok(r.saved === true || r.saved === undefined, 'saving does not fail');
  ok(r.writes.length === 1 && r.writes[0].t === 'profiles' && r.writes[0].user === 'zoe' && r.writes[0].fam === 'f' && r.writes[0].gpa === '3.8', "the grades are written to Zoe's row: " + JSON.stringify(r.writes));
  ok(r.zoeProfile === '3.8' && r.dadProfile === 'untouched' && r.alerts === 0, "Zoe's profile updated in the app, Dad's own profile untouched, no error popups");
  ok(errs.length === 0, 'no page errors: ' + errs.join(';')); await page.close(); }
// 2. Zoe is not locked out, and her own save still writes to her own row ------------------------------------------------
{ const { page } = await open();
  const r = await page.evaluate(async () => { __family({ user_id: 'zoe', role: 'student', display_name: 'Zoe' }); goto('profile'); await new Promise(r => setTimeout(r, 300));
    document.getElementById('pf-gpa').value = '3.9'; await saveProfileForm(); return { key: profKey(), editing: editingStudentProfile(), w: window.__log.filter(l => l.op === 'upsert').map(l => l.row.user_id) }; });
  ok(r.key === 'zoe' && !r.editing && r.w.length === 1 && r.w[0] === 'zoe', 'Zoe edits her own profile as before'); await page.close(); }
// 3. A non-parent relative can look but not edit ------------------------------------------------------------------------
{ const { page } = await open();
  const r = await page.evaluate(() => { __family({ user_id: 'gma', role: 'grandparent', display_name: 'Gran' }); state.members.push(state.me); return { ro: studentReadOnly(), editing: editingStudentProfile() }; });
  ok(r.ro === true && r.editing === false, 'other relatives stay read-only (the database only allows parents)'); await page.close(); }
// 4. Zoe joins with pending grades: they are kept unless they provably landed -----------------------------------------------
for (const [name, cfg, expectDelete] of [['copy fails', { upsertError: { message: 'permission denied' }, profileRow: null }, false], ['copy "succeeds" but no row exists', { upsertError: null, profileRow: null }, false], ['copy lands', { upsertError: null, profileRow: { user_id: 'zoe' } }, true]]) {
  const { page } = await open();
  const r = await page.evaluate(async cfg => { __family({ user_id: 'zoe', role: 'student', display_name: 'Zoe' }); Object.assign(window.__cfg, cfg);
    state.pending = { family_id: 'f', display_name: 'Zoe', profile: { gpa: '3.8', sat: '1400' } }; await maybeClaimPending();
    return { deleted: window.__log.some(l => l.t === 'pending_students' && l.op === 'delete'), pendingStillThere: !!state.pending }; }, cfg);
  ok(r.deleted === expectDelete, `pending grades ${expectDelete ? 'are cleared after they landed' : 'are KEPT'} when ${name}`); await page.close(); }
// 5. Dad keeps typing into the pending form after Zoe joined: he is told, not silently dropped ----------------------------------
{ const { page, errs } = await open();
  const nav = page.waitForEvent('framenavigated', { timeout: 8000 }).catch(() => null);   // the page reloads so Dad lands on Zoe's real profile
  const res = page.evaluate(async () => { window.alert = m => { window.name = 'ALERT:' + m; }; __family({ user_id: 'dad', role: 'parent', display_name: 'Dad' }); state.members = [{ user_id: 'dad', role: 'parent' }]; state.pending = { family_id: 'f', display_name: 'Zoe', profile: {} }; window.__cfg.pendingUpdateRows = []; return await saveProfile({ gpa: '3.5' }); }).catch(() => 'navigated');
  await nav; await res; await new Promise(r => setTimeout(r, 800)); const msg = await page.evaluate(() => window.name).catch(() => '');
  ok(/just joined/.test(msg) && nav, 'saving into a pending row that is gone tells Dad and reloads instead of pretending it saved: ' + msg + ' ' + errs.join(';')); await page.close(); }
await b.close(); srv.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
