// Oct 12: signed-out paths — landing tour link, sample family (header says "Exit sample", no real session),
// exiting the sample, invite code, sign in; tour reachable from Today and the phone More menu. Run: node tests/signed-out-flows-test.mjs
import { chromium } from '/tmp/claude-0/node_modules/playwright/index.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/fso/site'; fs.mkdirSync(SITE + '/media', { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
for (const f of ['tutorial.mp4', 'tutorial-poster.jpg']) fs.copyFileSync(new URL('../media/' + f, import.meta.url), SITE + '/media/' + f);
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'); const FAKE = fs.readFileSync('/tmp/claude-0/audit-ui/fake-supabase.js', 'utf8');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(8834);
const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const ok = {}, R = {};
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(`window.__PLAN="family"; window.__SIGNEDOUT=true;`);
  await page.route('**/supabase.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|\.netlify\/functions|wikimedia/, r => r.abort());
  const o = {}; const vis = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
  await page.goto('http://localhost:8834/index.html'); await page.waitForTimeout(2500);
  o.landing = { sample: await vis('#demo-start'), invite: await vis('[data-lp-account="signup"]'), tour: await vis('.lnd-tour'), signout: await vis('#signout') };
  await page.click('.lnd-tour'); await page.waitForTimeout(500);
  o.tourFromLanding = await page.evaluate(() => { const d = document.getElementById('dlg-guide'); const src = d && d.querySelector('source') && d.querySelector('source').getAttribute('src'); const open = d && d.open; if (d) { d.querySelector('video').pause(); d.close(); } return { open, src }; });
  await page.click('#demo-start'); await page.waitForTimeout(2500);
  o.sample = await page.evaluate(() => ({ demo: DEMO, signout: document.getElementById('signout').textContent.trim(), who: document.getElementById('whoami').textContent, bar: !document.getElementById('demo-bar').classList.contains('hidden'), token: state.session && state.session.access_token, view: currentView }));
  if (label === 'phone') { await page.click('[data-tb-more]'); await page.waitForTimeout(300); await page.click('#tb-sheet [data-guide-open]'); }
  else { await page.click('#v-today .td-tour'); }
  await page.waitForTimeout(400);
  o.tourInApp = await page.evaluate(() => { const d = document.getElementById('dlg-guide'); const r = d.open; d.querySelector('video').pause(); d.close(); return r; });
  await page.screenshot({ path: `/tmp/claude-0/fso/${label}-sample.png` });
  // header "Exit sample" (desktop) / demo bar Exit (phone header hides it) → back to the signed-out landing
  if (await vis('#signout')) await page.click('#signout'); else await page.evaluate(() => exitDemo());
  await page.waitForTimeout(2500);
  o.afterExit = { landing: await vis('#demo-start'), demo: await page.evaluate(() => typeof DEMO !== 'undefined' && DEMO), url: page.url() };
  // invite code → sign-up form; sign in → sign-in form
  await page.click('[data-lp-account="signup"]'); await page.waitForTimeout(600);
  o.invite = await page.evaluate(() => { const v = document.querySelector('section:not(.hidden)[id^="v-"]'); return { view: v && v.id, codeField: !!document.querySelector('#v-auth input[id*="code" i]:not([type=hidden]), #v-auth input[placeholder*="code" i]') }; });
  await page.goto('http://localhost:8834/index.html'); await page.waitForTimeout(2000);
  const signin = await page.$('header [data-lp-account="signin"], #lp-signin, button:has-text("Sign in")');
  if (signin) { await signin.click(); await page.waitForTimeout(600); }
  o.signin = await page.evaluate(() => { const v = document.querySelector('section:not(.hidden)[id^="v-"]'); return { view: v && v.id, pw: !!document.querySelector('#v-auth input[type=password]') }; });
  o.errs = errs; R[label] = o; await ctx.close();
  ok[label + '.landingHasTour'] = o.landing.sample && o.landing.invite && o.landing.tour && !o.landing.signout;
  ok[label + '.tourPlaysFromLanding'] = o.tourFromLanding.open && /tutorial\.mp4/.test(o.tourFromLanding.src || '');
  ok[label + '.sampleIsNotSignedIn'] = o.sample.demo === true && o.sample.token == null && o.sample.who === 'Sample family' && o.sample.bar && o.sample.signout === 'Exit sample';
  ok[label + '.tourInsideApp'] = o.tourInApp === true;
  ok[label + '.exitReturnsToLanding'] = o.afterExit.landing && !o.afterExit.demo;
  ok[label + '.inviteOpensSignup'] = o.invite.view === 'v-auth';
  ok[label + '.signInOpensForm'] = o.signin.view === 'v-auth' && o.signin.pw;
  ok[label + '.noErrors'] = !errs.length;
}
await b.close(); srv.close();
const allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify({ ok, R }, null, 1)); console.log(JSON.stringify({ allPass }));
