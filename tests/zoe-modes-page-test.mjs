// #46 Ask Zoe page: mode cards (week, essay, huddle, stack), memory, clear reasons + Try again. Run: node tests/zoe-modes-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f46/site', SHOTS = '/tmp/claude-0/f46/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), DL = fs.readFileSync('/tmp/claude-0/f33/dl.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8808);
const R = {}, ok = {};
for (const [label, vp, dark] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*deadlines-2026-27\.json/, r => r.fulfill({ contentType: 'application/json', body: DL }));
  const bodies = []; let failNext = 0;
  await page.route('**/.netlify/functions/zoe-ai', r => { const bd = JSON.parse(r.request().postData() || '{}'); bodies.push(bd);
    if (failNext > 0) { failNext--; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: null, error: 'busy', status: 429 }) }); }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: `**${bd.mode}** answer to: ${String(bd.q).slice(0, 40)}`, mode: bd.mode }) }); });
  await page.goto('http://localhost:8808/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(1200);
  await page.evaluate(() => goto('zoe')); await page.waitForTimeout(400);
  const o = {};
  o.cards = await page.evaluate(() => [...document.querySelectorAll('.zm-card b')].map(x => x.textContent));
  await page.screenshot({ path: `${SHOTS}${label}-zoe.png` });
  // 1) Plan my week
  await page.click('[data-zm="week"]'); await page.waitForTimeout(700);
  o.week = bodies.at(-1);
  // 2) Essay coach: too short -> nudge; real draft -> essay mode with the draft
  await page.click('[data-zm="essay"]'); await page.waitForTimeout(200);
  await page.fill('#zm-draft', 'Too short.'); await page.click('#zm-fb'); await page.waitForTimeout(200);
  o.shortMsg = await page.textContent('#zm-wc');
  const draft = Array.from({ length: 120 }, (_, i) => 'word' + i).join(' ');
  await page.fill('#zm-draft', draft); await page.click('#zm-fb'); await page.waitForTimeout(700);
  o.essay = bodies.at(-1);
  await page.screenshot({ path: `${SHOTS}${label}-essay.png` });
  // 3) Family huddle (fake data: Charleston rated 4 and 5, MIT rated 3)
  await page.click('[data-zm="huddle"]'); await page.waitForTimeout(200);
  o.huddleOptions = await page.evaluate(() => [...document.querySelectorAll('#zm-school option')].map(x => x.textContent));
  await page.click('#zm-huddle'); await page.waitForTimeout(700);
  o.huddle = bodies.at(-1);
  // 4) memory: next question carries the history
  await page.fill('#ztab-in', 'tell me more about that'); await page.press('#ztab-in', 'Enter'); await page.waitForTimeout(700);
  o.history = (bodies.at(-1).history || []).map(h => h.role + ':' + h.text.slice(0, 30));
  // 5) busy twice -> reason + Try again -> answer
  failNext = 2; await page.fill('#ztab-in', 'tell me a fun fact about college mascots'); await page.press('#ztab-in', 'Enter'); await page.waitForTimeout(2600);
  o.busyMsg = await page.evaluate(() => { const m = [...document.querySelectorAll('#ztab-log .zmsg.z')].at(-1); return m.innerText; });
  await page.click('#ztab-log [data-zretry]'); await page.waitForTimeout(900);
  o.afterRetry = await page.evaluate(() => [...document.querySelectorAll('#ztab-log .zmsg.z')].at(-1).innerText);
  o.audit = await audit(page, '#v-zoe'); o.errors = log.pageerr; R[label] = { ...o, week: o.week && { mode: o.week.mode, ctx: { upcoming: o.week.ctx.upcoming, gaps: (o.week.ctx.gaps || []).length } }, essay: o.essay && { mode: o.essay.mode, qLen: o.essay.q.length }, huddle: o.huddle && { mode: o.huddle.mode, ctx: o.huddle.ctx.huddle } };
  await b.close();
  ok[label + '.fourCards'] = JSON.stringify(o.cards) === '["Plan my week","Essay coach","Family huddle","How do I stack up?"]';
  ok[label + '.weekSendsDeadlines'] = o.week.mode === 'week' && o.week.ctx.upcoming.length > 0 && o.week.ctx.upcoming[0].school === 'Clemson University' && Array.isArray(o.week.ctx.gaps);
  ok[label + '.essayShortNudge'] = /40\+ words/.test(o.shortMsg);
  ok[label + '.essaySendsDraft'] = o.essay.mode === 'essay' && o.essay.q.includes('word119');
  ok[label + '.huddleByRoleNoNames'] = o.huddle.mode === 'huddle' && JSON.stringify(o.huddle.ctx.huddle).includes('Student') && !/Obie|"Zoe"/.test(JSON.stringify(o.huddle.ctx.huddle)) && o.huddleOptions.length >= 2;
  ok[label + '.memory'] = o.history.length >= 4 && o.history[0].startsWith('user:') && o.history.some(h => h.startsWith('zoe:'));
  ok[label + '.busyExplainedAndRetry'] = /very busy/.test(o.busyMsg) && /Try again/.test(o.busyMsg) && /chat/.test(o.afterRetry);
  ok[label + '.noErrors'] = !o.errors.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./zoe-modes-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
