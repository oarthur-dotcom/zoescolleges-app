// #76: activity strength weighs commitment (hours x weeks x years) + role/recognition; the Save button shows it saved.
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f76/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8941);
const R = {}, ok = {};
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.addInitScript('window.__ASSTUDENT=true;');
  await page.goto('http://localhost:8941/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  o.levels = await page.evaluate(() => {
    const zoe = [ { category: 'Athletics: JV/Varsity', sport: 'Field Hockey', position: 'Team member', tier: 4, grades: ['10','11','12'], hrs: 18, weeks: 14 },
      { category: 'Athletics: JV/Varsity', sport: 'Rugby', position: 'Team member', tier: 4, grades: ['10','11','12'], hrs: 18, weeks: 14 },
      { category: 'Work (Paid)', position: 'Employee', tier: 4, grades: ['10','11'], hrs: 25, weeks: 8, timing: 'During school break' },
      { category: 'Other Club/Activity', tier: 4, grades: ['11','12'], hrs: 2, weeks: 34 } ];
    const cap = zoe.map((a, i) => i === 0 ? { ...a, position: 'Captain' } : a);
    const one = [{ category: 'Other Club/Activity', tier: 4, grades: ['11'], hrs: 2, weeks: 34 }];
    const w = a => astrWord(activityStrength(a));
    return { zoe: w(zoe), zoeS: +activityStrength(zoe).toFixed(2), zoeWhy: activityWhy(zoe), captain: w(cap), oneClub: w(one), national: w([{ category: 'Academic', tier: 1, grades: ['11','12'], hrs: 6, weeks: 34 }, ...zoe.slice(0, 2)]) };
  });
  // the Save activities button: put Zoe's list in, click, message must be visible after the redraw
  await page.evaluate(() => { goto('profile'); }); await page.waitForTimeout(400);
  await page.evaluate(() => { const e = document.querySelector('[data-pf-edit]'); if (e) e.click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { profActs = [{ category: 'Athletics: JV/Varsity', sport: 'Rugby', position: 'Team member', tier: 4, grades: ['10','11','12'], hrs: 18, weeks: 14, timing: 'During school year' }]; actDirty = true; renderActs(); });
  await page.evaluate(() => document.getElementById('pf-save2').scrollIntoView({ block: 'center' })); await page.click('#pf-save2'); await page.waitForTimeout(500);
  o.afterSave = await page.evaluate(() => ({ msg: (document.getElementById('pf-savemsg2') || {}).textContent || '', btn: (document.getElementById('pf-save2') || {}).textContent || '',
    wrote: window.__writes.filter(w => w.table === 'profiles').length, strengthLine: (document.getElementById('pf-act-strength') || {}).textContent || '' }));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.zoeIsSolid'] = o.levels.zoe === 'solid' && o.levels.zoeS >= 0.55 && /2 sports with real time/.test(o.levels.zoeWhy) && /a job with real hours/.test(o.levels.zoeWhy) && /leadership role/.test(o.levels.zoeWhy);
  ok[label + '.captainMakesStrong'] = o.levels.captain === 'strong';
  ok[label + '.oneSmallClubIsLight'] = o.levels.oneClub === 'light';
  ok[label + '.nationalHonorStrong'] = o.levels.national === 'strong';
  ok[label + '.saveShowsSaved'] = /Saved — 1 activity/.test(o.afterSave.msg) && o.afterSave.wrote >= 1;
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.phone.levels), JSON.stringify(R.phone.afterSave)); console.log(JSON.stringify(ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./activities-v3-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
