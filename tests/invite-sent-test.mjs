// Oct 12: the next step remembers the invite went out ("Waiting for Zoe to join"); "I already sent it" for earlier sends;
// family icon is gender-neutral (👥). Run: node tests/invite-sent-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/finv/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'); const HTML = fs.readFileSync(SITE + '/index.html', 'utf8');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8833);
const ok = {}; const b = await launch(); const { page, log } = await newPage(b, { width: 1280, height: 900 }, {});
await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
await page.route('**/.netlify/functions/invite-send', r => r.fulfill({ contentType: 'application/json', body: '{"sent":true}' }));
await page.goto('http://localhost:8833/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(800);
const card = () => page.evaluate(() => { const c = document.querySelector('.ns-card'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
await page.evaluate(() => { state.pending = { display_name: 'Zoe' }; try { lsSet('inviteSentAt', null); } catch (e) {} state.members = state.members.slice(0, 1); const orig = setupSteps; window.setupSteps = () => orig().map(x => x.k === 'family' ? x : { ...x, done: true }); goto('today'); renderToday(); }); await page.waitForTimeout(500);
const c1 = await card(); const hasFamilyStep = /Send Zoe the invite/.test(c1);
if (hasFamilyStep) { await page.click('#ss-sent'); await page.waitForTimeout(400); }
const c2 = await card();
ok.firstShowsSend = hasFamilyStep && /I already sent it/.test(c1);
ok.alreadySentMarks = /Waiting for Zoe to join/.test(c2) && /Invite sent/.test(c2) && /Resend invite/.test(c2) && !/I already sent it/.test(c2);
await page.evaluate(() => { lsSet('inviteSentAt', null); renderToday(); openInvite(); }); await page.waitForTimeout(300);
await page.fill('#inv-email', 'zoe@example.com'); await page.click('#inv-send'); await page.waitForTimeout(600);
await page.evaluate(() => { try { document.getElementById('dlg-invite').close(); } catch (e) {} });
ok.sendMarks = /Waiting for Zoe to join/.test(await card());
ok.neutralIcon = !/👪|👨‍👩‍👧/.test(HTML) && /👥/.test(HTML);
ok.noErrors = !log.pageerr.length; await b.close(); srv.close();
const allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify({ ok, c1, c2, errors: log.pageerr }, null, 1)); console.log(JSON.stringify({ allPass }));
