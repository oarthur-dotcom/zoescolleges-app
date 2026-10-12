// Oct 12: delete photos from Memories — ✕ on each photo you added, "Delete all" per visit, "Delete all my photos".
// Someone else's photo shows no ✕ and is never deleted. Run: node tests/memories-delete-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/fdel/site', SHOTS = '/tmp/claude-0/fdel/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const PNG = 'data:image/png;base64,' + fs.readFileSync('/tmp/claude-0/t1.png').toString('base64');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8831);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['desktop-dark', { width: 1280, height: 900 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { window.__dlg = []; window.confirm = m => { window.__dlg.push(m); return true; }; });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|wikimedia/, r => r.abort());
  await page.goto('http://localhost:8831/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = {};
  await page.evaluate(async (img) => { BACKEND.photos = false; BACKEND.photostore = false; const me = state.me.user_id, t = new Date().toISOString();
    const ph = (id, sid, uid, cap) => ({ id, school_id: sid, user_id: uid, data: img, caption: cap, created_at: t });
    lsSet('photos', [ph('ls-1', 'college-of-charleston', me, 'mine 1'), ph('ls-2', 'college-of-charleston', me, 'mine 2'), ph('other-1', 'college-of-charleston', 'someone-else', 'theirs'),
      ph('ls-3', 'university-of-vermont', me, 'uvm 1'), ph('ls-4', 'university-of-vermont', me, 'uvm 2')]);
    await loadPhotos(); goto('memories'); }, PNG);
  await page.waitForTimeout(600);
  const count = () => page.evaluate(() => ({ all: state.photos.length, ids: state.photos.map(p => p.id).sort().join(','), x: document.querySelectorAll('.mem-ph [data-del]').length, delAll: document.querySelectorAll('[data-mem-delall]').length, mine: !!document.getElementById('mem-delmine') }));
  o.start = await count();
  o.otherHasNoX = await page.evaluate(() => !document.querySelector('.mem-ph[data-ph="other-1"] [data-del]'));
  await page.screenshot({ path: `${SHOTS}${label}-start.png` });
  // ✕ one photo
  await page.click('.mem-ph[data-ph="ls-1"] [data-del]'); await page.waitForTimeout(500);
  o.afterOne = await count(); o.note = await page.evaluate(() => (document.querySelector('.mem-note') || {}).textContent || ''); o.dlg1 = await page.evaluate(() => window.__dlg.at(-1) || '');
  // Delete all at Charleston: ls-2 goes, the other person's photo stays
  await page.click('[data-mem-delall="college-of-charleston"]'); await page.waitForTimeout(500);
  o.afterVisit = await count(); o.dlg2 = await page.evaluate(() => window.__dlg.at(-1) || '');
  // Delete all my photos: UVM goes
  await page.click('#mem-delmine'); await page.waitForTimeout(500);
  o.afterAll = await count(); o.dlg3 = await page.evaluate(() => window.__dlg.at(-1) || '');
  o.stored = await page.evaluate(() => (lsGet('photos') || []).map(p => p.id).join(','));
  await page.screenshot({ path: `${SHOTS}${label}-end.png` });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.xOnlyOnMine'] = o.start.all === 5 && o.start.x === 4 && o.otherHasNoX && o.start.delAll === 2 && o.start.mine;
  ok[label + '.deleteOne'] = o.afterOne.all === 4 && !/ls-1/.test(o.afterOne.ids) && /Delete this photo\?/.test(o.dlg1) && /Photo deleted/.test(o.note);
  ok[label + '.deleteVisitKeepsOthers'] = o.afterVisit.ids === 'ls-3,ls-4,other-1' && /Delete 1 photo you added from College of Charleston/.test(o.dlg2) && /1 added by someone else will stay/.test(o.dlg2);
  ok[label + '.deleteAllMine'] = o.afterAll.ids === 'other-1' && /Delete 2 photos you added from every visit/.test(o.dlg3) && o.stored === 'other-1' && !o.afterAll.mine && o.afterAll.x === 0;
  ok[label + '.noErrors'] = !o.errors.length;
}
srv.close();
const allPass = Object.values(ok).every(Boolean);
fs.writeFileSync(new URL('./memories-delete-result-2026-10-12.json', import.meta.url), JSON.stringify({ ok, R }, null, 1));
console.log(JSON.stringify(ok, null, 1), allPass); console.log(JSON.stringify({ allPass }));
