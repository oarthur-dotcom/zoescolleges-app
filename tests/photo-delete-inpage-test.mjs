// Memories delete works even when the browser blocks confirm() pop-ups (X, Delete all at a school, Delete all my photos).
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8951);
const b = await chromium.launch(); const R = {}; let fail = 0; const ok = (n, v) => { R[n] = v; if (!v) { fail++; console.log('FAIL', n); } }; const errs = [];
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 844 } }); page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { window.confirm = () => false; window.alert = () => {}; });   // pop-ups blocked
  await page.goto('http://localhost:8951/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 });
  const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const seed = () => page.evaluate(px => { BACKEND.photos = false; lsSet('photos', [{ id: 'ls-1', school_id: 'college-of-charleston', url: px, caption: '' }, { id: 'ls-2', school_id: 'college-of-charleston', url: px, caption: '' }, { id: 'ls-3', school_id: 'university-of-vermont', url: px, caption: '' }]); state.photos = lsGet('photos'); goto('memories'); renderMemories(); }, px);
  const n = () => page.evaluate(() => state.photos.length);
  await seed(); await page.waitForTimeout(500);
  await page.click('.mem-ph[data-ph="ls-1"] [data-del]'); await page.waitForSelector('.ask-ov'); ok(W + ':dialogShows', true);
  await page.click('.ask-ov [data-no]'); ok(W + ':cancelKeeps', (await n()) === 3 && !(await page.$('.ask-ov')));
  await page.click('.mem-ph[data-ph="ls-1"] [data-del]'); await page.click('.ask-ov .ask-go'); await page.waitForTimeout(500); ok(W + ':xDeletes', (await n()) === 2);
  await page.click('[data-mem-delall="college-of-charleston"]'); await page.click('.ask-ov .ask-go'); await page.waitForTimeout(500); ok(W + ':deleteAllAtSchool', (await n()) === 1);
  // remove a school from the board (detail page + board card) with pop-ups blocked
  const rm = await page.evaluate(async () => { const id = state.schools[0].school_id; const before = state.schools.length; goto('board'); renderBoard && renderBoard(); return { id, before }; });
  await page.waitForTimeout(400);
  const btn = await page.$('[data-remove]'); ok(W + ':removeButtonExists', !!btn);
  if (btn) { await btn.evaluate(e => e.click()); await page.waitForSelector('.ask-ov'); ok(W + ':removeAsksInPage', true); await page.click('.ask-ov [data-no]'); ok(W + ':cancelKeepsSchool', (await page.evaluate(() => state.schools.length)) === rm.before); }
  await seed(); await page.waitForTimeout(300); await page.click('#mem-delmine'); await page.click('.ask-ov .ask-go'); await page.waitForTimeout(500); ok(W + ':deleteAllMine', (await n()) === 0);
}
console.log(fail ? 'FAILED' : 'PASS', JSON.stringify(R), 'pageerrors:', errs.length, errs.slice(0, 2)); await b.close(); process.exit(fail ? 1 : 0);
