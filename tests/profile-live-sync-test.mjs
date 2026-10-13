// Profile stays in step across devices. Run: node tests/profile-live-sync-test.mjs
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html'}); r.end(d); }); }).listen(8911);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const page = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:8911/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
const R = {};
await page.evaluate(() => { DEMO = false; });   // use the sample database as if it were the real shared one
R.before = await page.evaluate(() => { const p = studentProfile(); return { gpa: p.gpa, rigor: p.rigor || null, to: !!p.testOptional }; });
// another device changes the shared profile
await page.evaluate(async () => { await sb.from('profiles').update({ gpa: '3.1', test_optional: true, rigor: { grade: 12, level: 5, honors: 8 } }).eq('user_id', DEMO_UID); });
R.staleUntilSync = await page.evaluate(() => studentProfile().gpa);
await page.evaluate(() => syncShared(true)); await page.waitForTimeout(300);
R.after = await page.evaluate(() => { const p = studentProfile(); return { gpa: p.gpa, rigor: p.rigor, to: !!p.testOptional }; });
// coming back to the app triggers a sync
await page.evaluate(async () => { await sb.from('profiles').update({ gpa: '3.9' }).eq('user_id', DEMO_UID); _syncAt = 0; });
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(500);
R.onForeground = await page.evaluate(() => studentProfile().gpa);
// a failed refresh keeps what we have
R.keepOnError = await page.evaluate(async () => { const real = sb.from; sb.from = t => { if (t === 'profiles') throw new Error('network'); return real(t); }; try { await syncShared(true); } catch (e) {} sb.from = real; return studentProfile() && studentProfile().gpa; });
// typing in the profile form is never overwritten
R.typing = await page.evaluate(async () => { goto('profile'); pfEdit = true; renderProfileView(); await new Promise(r => setTimeout(r, 300)); const g = document.getElementById('pf-gpa'); g.focus(); g.value = '2.5';
  await sb.from('profiles').update({ gpa: '3.3' }).eq('user_id', DEMO_UID); await syncShared(true); return { field: document.getElementById('pf-gpa').value, state: studentProfile().gpa }; });
// no empty flash while refreshing
R.noFlash = await page.evaluate(async () => { let empty = 0; const orig = renderBoard; const t = setInterval(() => { if (!Object.keys(state.profiles).length) empty++; }, 1); await loadProfiles(); clearInterval(t); return empty; });
const ok = {
  startsWithSample: R.before.gpa === '3.6',
  syncPicksUpChange: R.after.gpa === '3.1' && R.after.to === true && R.after.rigor && R.after.rigor.level === 5,
  foregroundSync: R.onForeground === '3.9',
  errorKeepsProfile: R.keepOnError === '3.9',
  typingKept: R.typing.field === '2.5' && R.typing.state === '3.3',
  noEmptyFlash: R.noFlash === 0,
  noPageErrors: errs.length === 0 };
console.log(JSON.stringify({ R, ok, errs }, null, 1), Object.values(ok).every(Boolean)); await b.close(); srv.close();
