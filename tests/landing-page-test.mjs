// #63 Landing page for new families. Run: node tests/landing-page-test.mjs
import { launch, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f63/site', SHOTS = '/tmp/claude-0/f63/'; fs.mkdirSync(SITE + '/media', { recursive: true });
fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
for (const f of fs.readdirSync(new URL('../media', import.meta.url))) if (fs.statSync(new URL('../media/' + f, import.meta.url)).isFile()) fs.copyFileSync(new URL('../media/' + f, import.meta.url), SITE + '/media/' + f);
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.webp') ? 'image/webp' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(8863);
const b = await launch(); const R = {}, ok = {};
const page = async (vp, dark) => { const ctx = await b.newContext({ viewport: vp, colorScheme: dark ? 'dark' : 'light' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await p.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort()); return { ctx, p, errs }; };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const { ctx, p, errs } = await page(vp, dark); const o = {};
  await p.goto('http://localhost:8863/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SHOTS}${label}-full.png`, fullPage: true });
  o.view = await p.evaluate(() => currentView);
  o.hero = await p.evaluate(() => ({ h1: document.querySelector('.lnd-h1').textContent, ctas: [...document.querySelectorAll('.lnd-ctas button')].map(x => x.textContent), headerSignin: !document.getElementById('hdr-signin').classList.contains('hidden'), sections: document.querySelectorAll('.lnd-row').length, imgs: [...document.querySelectorAll('#v-auth img')].map(i => i.naturalWidth > 0), card: !!document.querySelector('#lp-account #go-auth') }));
  o.audit = await audit(p, 'body');
  await p.click('.lnd-ctas [data-lp-account="signup"]'); await p.waitForTimeout(900);
  o.signup = await p.evaluate(() => ({ mode: state.authMode, code: !document.getElementById('code-wrap').classList.contains('hidden'), top: Math.round(document.getElementById('lp-account').getBoundingClientRect().top) }));
  await p.click('#hdr-signin'); await p.waitForTimeout(800); o.signin = await p.evaluate(() => ({ mode: state.authMode, btn: document.getElementById('go-auth').textContent }));
  await p.click('#lp-trust2'); await p.waitForTimeout(300); o.trust = await p.evaluate(() => document.getElementById('v-trust').classList.contains('hidden') ? 'hidden' : 'trust');
  o.errs = errs; R[label] = o; await ctx.close();
  ok[label + '.landingShows'] = o.view === 'auth' || o.view === 'v-auth' || /College, decided together/.test(o.hero.h1);
  ok[label + '.heroAndCtas'] = /College, decided together/.test(o.hero.h1) && o.hero.ctas.length === 2 && /sample family/.test(o.hero.ctas[0]) && o.hero.headerSignin && o.hero.sections === 4 && o.hero.card;
  ok[label + '.allImagesLoad'] = o.hero.imgs.length === 5 && o.hero.imgs.every(Boolean);
  ok[label + '.inviteCodeOpensSignup'] = o.signup.mode === 'signup' && o.signup.code && o.signup.top < 200;
  ok[label + '.headerSignIn'] = o.signin.mode === 'signin' && /Sign in/.test(o.signin.btn);
  ok[label + '.trustPage'] = /trust/.test(o.trust);
  ok[label + '.noErrors'] = !errs.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
{ const { ctx, p, errs } = await page({ width: 390, height: 844 });
  await p.goto('http://localhost:8863/index.html?join=abc123'); await p.waitForTimeout(2500); await p.screenshot({ path: `${SHOTS}join.png` });
  R.join = await p.evaluate(() => ({ focus: document.getElementById('lp').classList.contains('focus'), hero: getComputedStyle(document.querySelector('.lnd-hero')).display, title: document.getElementById('lp-fo-title').textContent, mode: state.authMode }));
  await p.click('#lp-unfocus'); await p.waitForTimeout(300); R.unfocus = await p.evaluate(() => getComputedStyle(document.querySelector('.lnd-hero')).display);
  ok['invitee.focused'] = R.join.focus && R.join.hero === 'none' && /invited/.test(R.join.title) && R.join.mode === 'signup' && R.unfocus === 'grid' && !errs.length; await ctx.close(); }
{ const { ctx, p, errs } = await page({ width: 390, height: 844 });
  await p.goto('http://localhost:8863/index.html'); await p.waitForTimeout(2500); await p.click('#demo-start'); await p.waitForTimeout(3500);
  R.demo = await p.evaluate(() => ({ demo: typeof DEMO !== 'undefined' && DEMO, view: currentView }));
  ok['sampleFamilyButton'] = R.demo.demo && !errs.length; await ctx.close(); }
await b.close(); srv.close();
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./landing-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
