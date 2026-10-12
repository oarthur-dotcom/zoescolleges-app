// #67 Step 3: one next-best-step card, no empty cards, invite by email in the app. Run: node tests/first-time-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f67/site', SHOTS = '/tmp/claude-0/f67/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8904);
const R = {}, ok = {};
const open = async (b, vp, opts, init, dark) => { const { page, log } = await newPage(b, vp, opts || {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' }); await page.addInitScript(init || '');
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8904/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(700); return { page, log }; };
const card = p => p.evaluate(() => { const c = document.querySelector('#td-student .ns-card'); return c ? { t: c.querySelector('.ns-t').textContent, ring: c.querySelector('.ns-ring text').textContent, chips: [...c.querySelectorAll('.ns-chip')].map(x => x.className.includes('done') ? 'done' : x.className.includes('cur') ? 'cur' : 'todo'), stages: c.querySelectorAll('.ns-stages span').length } : null; });
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const o = {};
  // A. Brand-new family: parent alone, no schools
  { const { page, log } = await open(b, vp, { empty: true }, 'window.__NOSTUDENT=true;', dark);
    o.new1 = await card(page);
    o.empties = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#td-out .td-card .td-h')].map(x => x.textContent.trim()), howto: !document.getElementById('howto').classList.contains('hidden'), onboard: document.getElementById('onboard-guide').innerHTML.trim().length, tour: !!document.querySelector('[data-guide]') }));
    await page.screenshot({ path: `${SHOTS}${label}-new.png` });
    await page.fill('#ss-name', 'Zoe'); await page.click('#ss-save'); await page.waitForTimeout(500);
    o.new2 = await card(page);
    await page.click('.ns-chip:last-child'); await page.waitForTimeout(400);   // jump to "Send Zoe the invite"
    o.dlg = await page.evaluate(() => ({ open: document.getElementById('dlg-invite').open, name: document.getElementById('inv-name').value, seat: document.getElementById('seatnote').textContent }));
    let sentBody = null; await page.route('**/.netlify/functions/invite-send', async r => { sentBody = JSON.parse(r.request().postData() || '{}'); await r.fulfill({ contentType: 'application/json', body: '{"sent":true}' }); });
    await page.click('#inv-send'); await page.waitForTimeout(200); o.noEmailMsg = await page.textContent('#inv-sendmsg');
    await page.fill('#inv-email', 'zoe@example.com'); await page.click('#inv-send'); await page.waitForTimeout(600);
    o.sent = { body: sentBody, msg: await page.textContent('#inv-sendmsg') };
    await page.screenshot({ path: `${SHOTS}${label}-invite.png` });
    await page.evaluate(() => document.getElementById('dlg-invite').close());
    await page.click('[data-guide]'); await page.waitForTimeout(300); o.guide = await page.evaluate(() => ({ open: document.getElementById('dlg-guide').open, seen: localStorage.getItem('zc_guide_seen') }));
    await page.evaluate(() => { const d = document.getElementById('dlg-guide'); d.querySelector('video').pause(); d.close(); });
    o.audit = await audit(page, 'body'); o.errA = log.pageerr; }
  // B. Set-up family: student joined with grades, priorities set -> an ongoing next step + journey stages
  { const { page, log } = await open(b, vp, {}, '', dark);
    o.mid = await card(page);
    await page.evaluate(async () => { const z = state.members.find(m => m.role === 'student'); state.profiles[z.user_id] = { user_id: z.user_id, gpa: '3.8', sat: '1350' }; state.prefs[state.me.user_id] = { ...defaultPrefs(), value: 9 }; renderToday(); }); await page.waitForTimeout(300);
    o.done = await card(page); o.doneAction = await page.evaluate(() => (document.querySelector('#td-student [data-ns-go="ongoing"]') || {}).textContent || '');
    o.zoeCard = await page.evaluate(() => !!document.querySelector('#td-out .td-zoe'));
    await page.screenshot({ path: `${SHOTS}${label}-ongoing.png` });
    o.errB = log.pageerr; }
  await b.close(); R[label] = o;
  ok[label + '.oneClearFirstStep'] = o.new1 && /Add your student/.test(o.new1.t) && o.new1.ring === '0/5' && o.new1.chips.length === 5 && o.new1.chips[0] === 'cur';
  ok[label + '.noEmptyCardsForNewFamily'] = !o.empties.cards.some(t => /Deadlines|Your list|New at your schools|Visits|Zoe suggests/.test(t)) && !o.empties.howto && o.empties.onboard === 0 && o.empties.tour;
  ok[label + '.advancesAfterStudent'] = o.new2 && /Add 3 or more schools/.test(o.new2.t) && o.new2.ring === '1/5' && o.new2.chips[0] === 'done';
  ok[label + '.inviteByEmailInApp'] = o.dlg.open && o.dlg.name === 'Zoe' && /email/i.test(o.noEmailMsg) && o.sent.body && o.sent.body.email === 'zoe@example.com' && o.sent.body.name === 'Zoe' && /Sent to zoe@example.com/.test(o.sent.msg);
  ok[label + '.tourOpens'] = o.guide.open && o.guide.seen === '1';
  ok[label + '.midSetupShowsWhatsLeft'] = o.mid && /Set your priorities|Add Zoe's grades|Ask Zoe/.test(o.mid.t + JSON.stringify(o.mid));
  ok[label + '.ongoingWithStages'] = o.done && o.done.stages === 4 && /\/4/.test(o.done.ring) && o.doneAction.length > 0 && o.zoeCard;
  ok[label + '.noErrors'] = !o.errA.length && !o.errB.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./first-time-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
