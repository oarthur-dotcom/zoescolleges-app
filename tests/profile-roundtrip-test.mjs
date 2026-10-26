// Profile round trip (enter, save, reload: nothing disappears), checklist, unsaved-changes bar, and activities never lowering chances (Oct 23).
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
const { page, errs } = await open();
const R = await page.evaluate(async () => {
  const g = id => document.getElementById(id), out = {}; const k = 'zoe';
  window.__family({ user_id: 'zoe', role: 'student', display_name: 'Zoe' }); state.profiles = {}; renderProfile(); renderProfileView(); g('v-profile').classList.remove('hidden');
  out.checklistStart = /0 of 4 done/.test(g('pf-checklist').textContent);
  // enter a profile through the form
  g('pf-gpa').value = '3.21'; g('pf-gpa').dispatchEvent(new Event('input', { bubbles: true })); g('pf-state').value = 'MA'; g('pf-honors').value = '9'; g('pf-grade').value = '12'; g('pf-noTest').checked = true;
  await new Promise(r => setTimeout(r, 700)); out.dirtyBar = !g('pf-savebar').classList.contains('hidden') && /Unsaved/.test(g('pf-savebar-msg').textContent);
  await saveProfileForm(); out.savedMsg = /Saved/.test(g('pf-savebar-msg').textContent);
  const row1 = window.__log.filter(x => x.op === 'upsert').pop().row; out.row1 = [row1.gpa, row1.home_state, row1.rigor.honors, row1.test_optional].join('|');
  // add activities one at a time through the activities save, several times, in different orders
  const A = [{ category: 'Work (Paid)', position: 'Employee', tier: 4, hrs: 25, weeks: 8, grades: [10, 11] }, { category: 'Community Service (Volunteer)', position: 'Volunteer', tier: 4, hrs: 2, weeks: 14, grades: [10, 11] }, { category: 'Other Club/Activity', position: 'Member / participant', tier: 4, hrs: 2, weeks: 30, grades: [11, 12] }];
  let wiped = 0;
  for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2]]) {
    profActs = []; for (const i of order) { profActs.push(A[i]); actDirty = true; g('pf-gpa').value = (Math.random() < .5 ? '' : g('pf-gpa').value); await saveActs();   // even a blank form box must not wipe the saved GPA
      const r = window.__log.filter(x => x.op === 'upsert').pop().row; if (r.gpa !== '3.21' || r.home_state !== 'MA' || r.rigor.honors !== 9) wiped++; }
    state.profiles[k] = { ...state.profiles[k], gpa: '3.21' };
  }
  out.wiped = wiped;
  // reload: rebuild state from the last saved row and re-render
  const last = window.__log.filter(x => x.op === 'upsert').pop().row; state.profiles = { zoe: { ...last } }; hydrateLocalProfile(); renderProfile(); renderProfileView();
  out.reload = [g('pf-gpa').value, g('pf-state').value, g('pf-honors').value, g('pf-noTest').checked].join('|');
  out.checklistDone = g('pf-checklist').innerHTML === '';
  return out; });
ok(R.checklistStart, 'checklist starts 0 of 4'); ok(R.dirtyBar, 'unsaved bar appears'); ok(R.savedMsg, 'saved message'); ok(R.row1 === '3.21|MA|9|true', 'first save row ' + R.row1);
ok(R.wiped === 0, 'activity saves never wiped grades, wiped=' + R.wiped); ok(R.reload === '3.21|MA|9|true', 'after reload ' + R.reload); ok(R.checklistDone, 'checklist done when complete');
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
console.log(`profile-roundtrip ${pass} pass, ${fail} fail`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
