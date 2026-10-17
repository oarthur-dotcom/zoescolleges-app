// Rigor: one "Offered at your school" question (no counselor-style dropdown), plain note on what Don't know means, and saved courses with an Edit my courses button.
// Run: node tests/rigor-offered-courses-test.mjs  (CHROME=/path/to/chrome to override the browser; the supabase CDN is served locally)
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
await page.evaluate(() => { window.__family({ user_id: 'zoe', role: 'student', display_name: 'Zoe' }); renderProfile(); });
const r = await page.evaluate(() => {
  const g = id => document.getElementById(id), out = {};
  out.noLevel = !g('pf-level'); out.noSchedLabel = !/the schedule is/i.test(document.body.innerHTML);
  out.defaultDontKnow = g('pf-offered').value === '';
  g('pf-gpa').value = '3.2'; g('pf-honors').value = '9'; g('pf-grade').value = '12';
  g('pf-honors').dispatchEvent(new Event('input'));
  out.noteDontKnow = /Don't know/.test(g('pf-adj').textContent) && /never lowers/.test(g('pf-adj').textContent);
  g('pf-offered').value = '11'; g('pf-offered').dispatchEvent(new Event('change'));
  out.noteOffered = /share of the courses open/.test(g('pf-adj').textContent);
  out.hiddenNoCourses = g('pf-courses').classList.contains('hidden');
  const f = txFields(["A1-01 Algebra 02 FY A 1.0","B2-01 English H 03 FY B 1.0","C3-01 Biology 02 FY A- 1.0","D4-01 History 02 FY B+ 1.0"], {});
  showTxPreview(f); g('txp-fill').click();
  out.line = !g('pf-courses').classList.contains('hidden') && /4 courses saved/.test(g('pf-courses').textContent);
  g('pf-courses').querySelector('button').click();
  out.rows = document.querySelectorAll('.txe-row').length;
  const rows = document.querySelectorAll('.txe-row'); const sel = rows[0].querySelector('.txe-l'); sel.value = 'AP'; sel.dispatchEvent(new Event('change'));
  g('txp-fill').click(); out.ap = g('pf-ap').value;
  out.saved = pfCourses.length + ':' + pfCourses[0].level;
  return out; });
ok(r.noLevel && r.noSchedLabel, 'counselor-style dropdown is gone'); ok(r.defaultDontKnow, 'default is Don\'t know'); ok(r.noteDontKnow, 'don\'t-know note explains the impact');
ok(r.noteOffered, 'offered note'); ok(r.hiddenNoCourses, 'no course line until courses exist'); ok(r.line, 'saved-courses line shows'); ok(r.rows === 4, 'Edit my courses reopens the list'); ok(r.ap === '1', 'edit flows back to the counts'); ok(r.saved === '4:AP', 'edited list is kept');
// saved with the profile
await page.evaluate(() => { document.getElementById('pf-gpa').value = '3.2'; });
const saved = await page.evaluate(async () => { const rows = []; const orig = saveProfileCore; window.saveProfileCore = async p => { rows.push(p); return true; }; try { await saveProfileForm({ stay: true }); } catch (e) { return { err: String(e) }; } return rows[0] && rows[0].rigor; });
ok(saved && Array.isArray(saved.courses) && saved.courses.length === 4 && saved.level === undefined || (saved && saved.level === 0), 'courses saved in rigor, no level: ' + JSON.stringify(saved && Object.keys(saved)));
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
console.log(`rigor-offered-courses ${pass} pass, ${fail} fail`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
