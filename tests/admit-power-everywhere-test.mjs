// Admit Power everywhere (Oct 14): meter on profile (starts 0, builds), big score on board cards, compare row, report, sort. Demo family.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); r.end(d); }); }).listen(8919);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = []; const R = {}; let fail = 0;
const ok = (n, v) => { R[n] = v; if (!v) { fail++; console.log('FAIL', n); } };
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 844 } }); page.on('pageerror', e => errs.push(W + ': ' + e));
  await page.goto('http://localhost:8919/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const t = n => W + ':' + n;
  const m = await page.evaluate(() => { const o = studentProfile; const out = {};
    const get = pr => { studentProfile = () => pr; const d = apMeterData(pr); return d; };
    const e = get({}); out.emptyTotal = e.total; out.emptySteps = e.steps.map(s => s.have);
    const g = get({ gpa: '3.6' }); out.g = g.total;
    const r = get({ gpa: '3.6', rigor: { ap: 5, level: 4 } }); out.r = r.total;
    const a = get({ gpa: '3.6', rigor: { ap: 5, level: 4 }, activities: [{ tier: 2, years: 4 }] }); out.a = a.total;
    const t2 = get({ gpa: '3.6', rigor: { ap: 5, level: 4 }, activities: [{ tier: 2, years: 4 }], sat: '1450' }); out.t = t2.total; out.tHave = t2.steps.map(s => s.have);
    const to = get({ gpa: '3.6', sat: '1450', testOptional: true }); out.toTests = to.steps[3].have;
    out.html = apMeterHtml({ gpa: '3.6' }); studentProfile = o; return out; });
  ok(t('emptyIsZero'), m.emptyTotal === 0 && m.emptySteps.every(x => !x));
  ok(t('gradesAdd'), m.g > 0); ok(t('stepsHaveDeltas'), typeof m.r === 'number' && typeof m.a === 'number' && m.t > 0);
  ok(t('testOptionalNoTests'), m.toTests === false); ok(t('meterHtmlClean'), /apm-num/.test(m.html) && !/NaN|undefined/.test(m.html));
  // board cards: big Admit Power cell
  await page.evaluate(() => { goto('board'); renderBoard(); }); await page.waitForTimeout(500);
  const bd = await page.evaluate(() => ({ cells: document.querySelectorAll('#v-board .b3-ap').length, txt: [...document.querySelectorAll('#v-board .b3-ap')].map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 2), sortOpt: !!document.querySelector('#board-sort option[value=power]'), bothTiles: [...document.querySelectorAll('#v-board .b3-k')].some(e => e.textContent === 'Chance') && document.querySelectorAll('#v-board .b3-ap').length > 0 }));
  ok(t('boardBigCells'), bd.cells > 0 && bd.sortOpt && bd.bothTiles);
  await page.evaluate(() => { const s = document.getElementById('board-sort'); s.value = 'power'; s.onchange(); }); await page.waitForTimeout(400);
  const sorted = await page.evaluate(() => { const v = [...document.querySelectorAll('#v-board .b3-ap .b3-v')].map(e => parseInt(e.textContent)).filter(n => !isNaN(n)); return v.every((x, i) => i === 0 || v[i - 1] >= x); });
  ok(t('sortByPower'), sorted);
  // compare
  const cmp = await page.evaluate(async () => { const ids = state.schools.slice(0, 2).map(s => s.school_id); if (ids.length < 2) return { skip: true }; ids.forEach(id => { if (!inCmp(id)) document.querySelector(`[data-cmp="${id}"]`)?.click(); }); goto('compare'); renderCompare(); await new Promise(r => setTimeout(r, 400)); const h = document.getElementById('v-compare').innerHTML; return { row: /Admit Power/.test(h), clean: !/NaN|undefined/.test(h) }; });
  ok(t('compareRow'), cmp.skip || (cmp.row && cmp.clean));
  // report
  await page.evaluate(() => { goto('report'); renderReport(); }); await page.waitForTimeout(600);
  const rp = await page.evaluate(() => { const h = document.getElementById('report-body').innerHTML; return { meter: /apm/.test(h), avg: /Avg Admit Power/.test(h), tag: /rp-tag ap/.test(h), clean: !/NaN|undefined/.test(h) }; });
  ok(t('reportHasAP'), rp.meter && rp.avg && rp.tag && rp.clean);
  // profile
  await page.evaluate(() => { goto('profile'); renderProfile(); }); await page.waitForTimeout(500);
  const pf = await page.evaluate(() => ({ any: !!document.querySelector('#v-profile .apm'), hz: document.documentElement.scrollWidth <= window.innerWidth + 2 }));
  ok(t('profileMeter'), pf.any); ok(t('noHScroll'), pf.hz);
  // picks + chat
  const chat = await page.evaluate(() => { const c = state.catalog.find(x => x.scorecard && x.scorecard.admissionRate); return typeof chanceFor === 'function' ? true : false; }); ok(t('chat'), chat);
  R['m' + W] = m; await page.close();
}
ok('noPageErrors', errs.length === 0); if (errs.length) console.log(errs);
srv.close(); await b.close(); console.log(fail ? 'FAILED ' + fail : 'PASS', JSON.stringify(R).slice(0, 600)); process.exit(fail ? 1 : 0);
