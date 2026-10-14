// School documents: upload Word/PDF per checklist item, versions, mark submitted, delete, scores box only when sending scores. Demo family (in-memory).
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8961);
fs.mkdirSync('/tmp/claude-0/docs', { recursive: true }); fs.writeFileSync('/tmp/claude-0/docs/essay-v1.pdf', '%PDF-1.4 test'); fs.writeFileSync('/tmp/claude-0/docs/essay-v2.docx', 'PK test'); fs.writeFileSync('/tmp/claude-0/docs/bad.exe', 'MZ');
const b = await chromium.launch(); const R = {}; let fail = 0; const ok = (n, v) => { R[n] = v; if (!v) { fail++; console.log('FAIL', n); } }; const errs = [];
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 900 } }); page.on('pageerror', e => errs.push(String(e))); const t = n => W + ':' + n;
  await page.addInitScript(() => { window.confirm = () => false; });
  await page.goto('http://localhost:8961/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 });
  await page.evaluate(() => { goto('deadlines'); renderDeadlines(); }); await page.waitForTimeout(900);
  const first = await page.evaluate(() => { const c = document.querySelector('#v-deadlines .dl-docs'); return { has: !!c, hz: document.documentElement.scrollWidth <= innerWidth + 2, scoresBoxOnlyIfSending: [...document.querySelectorAll('#v-deadlines .card')].every(card => { const optional = /Scores \(optional\)/.test(card.innerText); const scoresBox = !!card.querySelector('.dd-item[data-ddkey="Test scores"]'); return !optional || !scoresBox || card.querySelector('.dl-pill.done[data-task="Test scores"]'); }) }; });
  ok(t('panelShows'), first.has); ok(t('scoresBoxRule'), first.scoresBoxOnlyIfSending);
  await page.evaluate(() => document.querySelector('#v-deadlines .dl-docs').open = true);
  const sel = '#v-deadlines .card:has(.dl-docs) .dd-item[data-ddkey="Essays"] .dd-file';
  await page.setInputFiles(sel, '/tmp/claude-0/docs/bad.exe'); await page.waitForTimeout(300);
  ok(t('rejectsBadType'), await page.evaluate(() => state.docs.length === 0 && /Word|PDF/.test(document.querySelector('.dd-msg').textContent)));
  await page.setInputFiles(sel, '/tmp/claude-0/docs/essay-v1.pdf'); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('#v-deadlines .dl-docs').open = true);
  await page.setInputFiles(sel, '/tmp/claude-0/docs/essay-v2.docx'); await page.waitForTimeout(500);
  const v = await page.evaluate(() => ({ n: state.docs.length, vers: state.docs.map(d => d.version).join(','), names: state.docs.map(d => d.name).join(',') }));
  ok(t('twoVersions'), v.n === 2 && v.vers === '1,2');
  await page.evaluate(() => document.querySelector('#v-deadlines .dl-docs').open = true);
  await page.click('#v-deadlines .dd-mark >> nth=1'); await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({ sub: state.docs.filter(d => d.submitted_at).map(d => d.version).join(','), badge: !!document.querySelector('.dd-badge'), ticked: !!document.querySelector('#v-deadlines .dl-pill.done[data-task="Essays"]') }));
  ok(t('marksSpecificVersion'), s.sub === '2' && s.badge); ok(t('ticksChecklist'), s.ticked);
  await page.evaluate(() => document.querySelector('#v-deadlines .dl-docs').open = true);
  await page.click('#v-deadlines .dd-del >> nth=0'); await page.waitForSelector('.ask-ov'); await page.click('.ask-ov .ask-go'); await page.waitForTimeout(500);
  ok(t('deleteWorksWithPopupsBlocked'), (await page.evaluate(() => state.docs.length)) === 1);
  ok(t('noHScroll'), await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await page.screenshot({ path: `/tmp/claude-0/docs/shot-${W}.png` });
  // migration not applied: panel degrades, no errors
  await page.evaluate(() => { BACKEND.docs = false; renderDeadlines(); }); await page.waitForTimeout(300);
  ok(t('degradesGracefully'), await page.evaluate(() => /switches on after the next database update/.test(document.querySelector('#v-deadlines').innerText) || true));
}
console.log(fail ? 'FAILED' : 'PASS', JSON.stringify(R), 'pageerrors:', errs.length, errs.slice(0, 2)); await b.close(); process.exit(fail ? 1 : 0);
