// Admit Power (Oct 14): invariants of the score, the waterfall UI and the "secret sauce" page. Demo family — no database.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':f.endsWith('.html')?'text/html':'text/javascript'}); r.end(d); }); }).listen(8918);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = []; const R = {};
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 844 } }); page.on('pageerror', e => errs.push(W + ': ' + e));
  await page.goto('http://localhost:8918/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const K = R['w' + W] = {};
  K.math = await page.evaluate(() => {
    const cat = state.catalog.filter(c => c.scorecard && typeof c.scorecard.admissionRate === 'number');
    const mid = cat.find(c => c.scorecard.admissionRate > 0.45 && c.scorecard.admissionRate < 0.6 && typeof c.scorecard.sat25 === 'number');
    const top = cat.find(c => c.scorecard.admissionRate < 0.12); const sel = cat.find(c => c.scorecard.admissionRate > 0.15 && c.scorecard.admissionRate < 0.24);
    const orig = studentProfile; const set = pr => { studentProfile = () => ({ ...pr }); }; const sc = (c, pr) => { set(pr); return chanceCompute(c, true); };
    const inp = apInputs({ gpa: '3.5' }); const w1 = Object.values(AP.W_TESTS).reduce((a, b) => a + b, 0), w2 = Object.values(AP.W_NOTESTS).reduce((a, b) => a + b, 0);
    const lo = sc(mid, { gpa: '3.0', rigor: { ap: 2 } }).score, hi = sc(mid, { gpa: '3.9', rigor: { ap: 8 } }).score;
    const withSat = sc(mid, { gpa: '3.5', sat: '1400' }), to = sc(mid, { gpa: '3.5', sat: '1400', testOptional: true }), none = sc(mid, { gpa: '3.5' });
    const typ = sc(mid, { gpa: String(typicalGpa(mid.scorecard)), sat: String(Math.round((mid.scorecard.sat25 + mid.scorecard.sat75) / 2)), rigor: { level: 3 } });
    const strong = { gpa: '4.0', sat: '1600', rigor: { ap: 12, level: 5 }, activities: [{ tier: 1, years: 4 }, { tier: 1, years: 4 }] };
    const topBand = sc(top, strong), selBand = sc(sel, strong);
    const noData = sc(mid, {}); const full = sc(mid, { gpa: '3.4', rigor: { ap: 3 }, activities: [{ tier: 3, years: 3 }] });
    const perf = (() => { set({ gpa: '3.6', sat: '1300', rigor: { ap: 4 } }); const t = performance.now(); cat.forEach(c => chanceFor(c)); return Math.round(performance.now() - t); })();
    const ptsSum = full.power.terms.reduce((a, t) => a + t.pts, 0) + full.power.major; studentProfile = orig;
    return { weightsSum: Math.abs(w1 - 1) < 1e-9 && Math.abs(w2 - 1) < 1e-9, monotonic: hi > lo, inRange: hi <= 100 && lo >= 0, typicalNear50: Math.abs(typ.score - 50) <= 12, typScore: typ.score,
      testsOnlyWhenSubmitted: withSat.power.hasT && !to.power.hasT && !none.power.hasT, toIgnoresSat: to.score === none.score,
      noDataNull: noData.score == null, topAlwaysReach: topBand.band === 'reach', selectiveNeverLikely: selBand.band !== 'likely',
      stepKeys: ['Base band', 'Your GPA', 'Rigor in context', 'Your activities', 'Your test scores', 'Admit Power'].every(k => full.steps.some(s => s.k === k)),
      waterfallSums: Math.abs((50 + ptsSum) - full.score) <= 1.5, leversSorted: full.power.levers.every((l, i, a) => i === 0 || a[i - 1].d >= l.d), perfMs: perf, perfOk: perf < 2500 };
  });
  // UI: waterfall + sauce link on the school's math panel
  await page.evaluate(() => { goto('board'); renderBoard(); }); await page.waitForTimeout(400);
  K.ui = await page.evaluate(() => { const s = state.schools[0]; const html = chanceMathHtml(catInfo(s.school_id)); const d = document.createElement('div'); d.innerHTML = html;
    return { hasCard: !!d.querySelector('.ap-card'), hasNum: /ap-num/.test(html), rows: d.querySelectorAll('.ap-row').length >= 3, sauceLink: !!d.querySelector('[data-sauce]'), noNaN: !/NaN|undefined/.test(d.innerText), words: /Admit Power \d+\./.test(chanceWords(catInfo(s.school_id))) }; });
  // Sauce page
  await page.evaluate(() => { goto('today'); }); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.sauce = '1'; b.id = 'tmp-sauce'; document.body.appendChild(b); b.click(); }); await page.waitForTimeout(500);
  K.sauce = await page.evaluate(() => { const el = document.getElementById('v-sauce'); const t = el.innerText; return { shown: currentView === 'sauce' && !el.classList.contains('hidden'), title: /There is no secret sauce/.test(t), promise: /not exact/.test(t), example: /Your example: /.test(t), table: el.querySelectorAll('table tr').length === 5, sources: el.querySelectorAll('li a[href^="https://"]').length >= 5, weightsPrinted: /40%/.test(t) && /55%/.test(t), honestTO: /don't have per-school submission/.test(t), noNaN: !/NaN|undefined/.test(t) }; });
  await page.evaluate(() => document.querySelector('[data-sauce-back]').click()); await page.waitForTimeout(300);
  K.back = await page.evaluate(() => currentView === 'today');
  K.noOverflow = await page.evaluate(() => { goto('sauce'); return document.documentElement.scrollWidth <= window.innerWidth + 2; });
  await page.close();
}
const fails = []; for (const [w, K] of Object.entries(R)) { for (const [k, v] of Object.entries(K.math)) if (v === false) fails.push(w + ' math.' + k); for (const g of ['ui', 'sauce']) for (const [k, v] of Object.entries(K[g])) if (v === false) fails.push(w + ' ' + g + '.' + k); if (!K.back) fails.push(w + ' back'); if (!K.noOverflow) fails.push(w + ' overflow'); }
console.log(JSON.stringify(R, null, 1)); console.log('FAILED:', fails.length ? fails.join(', ') : 'none', '| pageerrors:', errs.length, errs.slice(0, 3));
await b.close(); srv.close(); process.exit(0);
