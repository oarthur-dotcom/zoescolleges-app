// Sign out never waits on the network; Add-my-family button gone; ranking lives in More; "not joined yet" line. Run: node tests/signout-nav-test.mjs
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(d); }); }).listen(8912);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const page = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch:true, isMobile:true }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:8912/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
const R = {};
await page.evaluate(() => { DEMO = false; goto('board'); }); await page.waitForTimeout(500);
R.noAddFamilyBtn = await page.evaluate(() => !document.getElementById('btn-invite') && !/\+ Add my family/.test(document.getElementById('v-board').innerText));
R.rankNotInToolbar = await page.evaluate(() => !document.querySelector('.row > #rank-toggle') && !!document.querySelector('#more-menu #rank-toggle'));
await page.click('#btn-more'); await page.click('#rank-toggle'); await page.waitForTimeout(400);
R.rankOn = await page.evaluate(() => rankMode && !document.getElementById('rank-hint').classList.contains('hidden') && /account/.test(document.getElementById('rank-hint').textContent) && !/this device/.test(document.getElementById('rank-hint').textContent));
R.menuClosed = await page.evaluate(() => document.getElementById('more-menu').classList.contains('hidden'));
await page.click('#btn-more'); await page.click('#rank-toggle'); await page.waitForTimeout(300);
R.rankOff = await page.evaluate(() => !rankMode);
// pending line
R.pending = await page.evaluate(() => { state.members = state.members.filter(m => m.role !== 'student'); state.me = { ...state.me, role: 'parent' }; state.pending = { display_name: 'Zoe' }; renderBoard(); const t1 = document.getElementById('famrow').textContent; state.pending = null; renderBoard(); const t2 = document.getElementById('famrow').textContent; return { shown: /Zoe not joined yet/.test(t1), goneWhenNone: !/not joined/.test(t2) }; });
// sign out with a server that never answers
await page.evaluate(() => { localStorage.setItem('sb-heppyuzvztjzhgfitrsb-auth-token', JSON.stringify({ access_token: 'tok123' })); window.__f = []; window.fetch = (u, o) => { window.__f.push({ u: String(u), a: o && o.headers && o.headers.Authorization }); return new Promise(() => {}); }; sb.auth.signOut = () => new Promise(() => {}); });
await page.evaluate(() => document.getElementById('signout').click()); await page.waitForTimeout(150);
R.signout = await page.evaluate(() => ({ authShown: !document.getElementById('v-auth').classList.contains('hidden'), keyGone: !localStorage.getItem('sb-heppyuzvztjzhgfitrsb-auth-token'), calls: window.__f }));
const nav = page.waitForNavigation({ timeout: 3000 }).then(() => true).catch(() => false); R.reloaded = await nav;
const ok = { noAddFamilyBtn: R.noAddFamilyBtn, rankInMore: R.rankNotInToolbar, rankOn: R.rankOn, menuClosed: R.menuClosed, rankOff: R.rankOff, pendingShown: R.pending.shown, pendingGone: R.pending.goneWhenNone,
  signoutInstant: R.signout.authShown && R.signout.keyGone, serverToldLocalOnly: R.signout.calls.some(c => /logout\?scope=local/.test(c.u) && c.a === 'Bearer tok123'), reloaded: R.reloaded, noPageErrors: errs.length === 0 };
console.log(JSON.stringify({ R, ok, errs }, null, 1), Object.values(ok).every(Boolean)); await b.close(); srv.close();
