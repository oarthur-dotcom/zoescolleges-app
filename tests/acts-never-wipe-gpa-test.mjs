// Saving activities never touches grades; no GPA means no chance labels (Oct 23).
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
const r = await page.evaluate(async () => {
  window.__family({ user_id: 'zoe', role: 'student', display_name: 'Zoe' }); const k = profKey(); const g = id => document.getElementById(id); const out = {};
  state.profiles[k] = { gpa: '3.21', test_optional: true, rigor: { honors: 9, grade: 12 }, activities: [] };
  renderProfile(); g('pf-gpa').value = '';            // the form box is blank/reset while 3.21 is saved
  profActs.push({ category: 'Community Service (Volunteer)', position: 'Volunteer', tier: 4, hrs: 2, weeks: 14, grades: [10, 11] }); actDirty = true;
  g('pf-save2').click(); await new Promise(r => setTimeout(r, 300));
  const up = window.__log.filter(x => x.op === 'upsert').pop();
  out.gpaKept = up && up.row.gpa === '3.21'; out.rigorKept = up && up.row.rigor && up.row.rigor.honors === 9; out.actSaved = up && up.row.activities.length === 1;
  // no GPA: no labels, a prompt instead of 90% Likely
  state.profiles[k] = { gpa: '', test_optional: true, rigor: { honors: 9, grade: 12 }, activities: [{ category: 'Work (Paid)', position: 'Employee', tier: 4, hrs: 25, weeks: 8, grades: [10, 11] }] };
  state.catalog = state.catalog && state.catalog.length ? state.catalog : [];
  out.noChance = chanceFor({ scorecard: { admissionRate: 0.5 } }) === null; out.cpNull = choicePower() === null; out.prompt = /Add the GPA/.test(choicePowerHtml());
  state.profiles[k].gpa = '3.21'; out.withGpa = chanceFor({ scorecard: { admissionRate: 0.5 } }) !== null;
  return out; });
for (const [n, v] of Object.entries(r)) ok(v === true, n + ' ' + v);
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
console.log(`acts-never-wipe-gpa ${pass} pass, ${fail} fail`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
