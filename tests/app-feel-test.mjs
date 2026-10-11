// #50 Phone app feel: installable (manifest + icons), service worker caches pinned data and the page, never Supabase/functions,
// works offline from cache, install card on Today. Run: node tests/app-feel-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname, SITE = '/tmp/claude-0/f50/site'; fs.mkdirSync(SITE + '/icons', { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) fs.copyFileSync(ROOT + f, SITE + '/' + f);
for (const f of fs.readdirSync(ROOT + 'icons')) fs.copyFileSync(ROOT + 'icons/' + f, SITE + '/icons/' + f);
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8812);
const ok = {}, R = {};
const man = JSON.parse(fs.readFileSync(ROOT + 'manifest.webmanifest', 'utf8'));
ok.manifestValid = man.display === 'standalone' && man.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable') && man.icons.some(i => i.sizes === '192x192') && man.start_url.startsWith('/');
const b = await launch(); const { ctx, page, log } = await newPage(b, { width: 390, height: 844 }, {});
let catHits = 0; await page.route(/jsdelivr.*colleges\.json/, r => { catHits++; r.fulfill({ contentType: 'application/json', body: CAT, headers: { 'access-control-allow-origin': '*' } }); });
await page.goto('http://localhost:8812/'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 });
R.swReady = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return !!reg.active; });
await page.reload(); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
R.controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
R.caches = await page.evaluate(async () => { const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k); out[k] = (await c.keys()).map(r => r.url.replace(/^https?:\/\//, '').slice(0, 80)); } return out; });
R.icons = await page.evaluate(async () => Promise.all(['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'].map(u => fetch(u).then(r => r.ok && r.headers.get('content-type')))));
// install card appears when the browser offers install
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }); await page.waitForTimeout(300);
R.installCard = await page.evaluate(() => (document.querySelector('.td-install') || {}).innerText || null);
await page.evaluate(() => document.querySelector('[data-install]').click()); await page.waitForTimeout(300);
R.prompted = await page.evaluate(() => !!window.__prompted);
// offline: the page still opens from cache
await ctx.setOffline(true); let offlineOk = true; try { await page.reload({ timeout: 15000 }); } catch (e) { offlineOk = false; }
await page.waitForTimeout(1500);
R.offline = { reloaded: offlineOk, title: await page.title().catch(() => ''), hasApp: await page.evaluate(() => !!document.getElementById('v-today')).catch(() => false) };
await ctx.setOffline(false);
R.errors = log.pageerr; await b.close(); srv.close();
const all = Object.values(R.caches).flat();
ok.swRegistersAndControls = R.swReady && R.controlled;
ok.pageCached = (R.caches['zc-shell-zc-v1'] || []).some(u => /localhost:8812\/$/.test(u));
ok.neverCachesPrivate = !all.some(u => /supabase|\.netlify\//.test(u));
ok.iconsServed = R.icons.every(t => t === 'image/png');
ok.installCard = /home screen/i.test(R.installCard || '') && R.prompted;
ok.opensOffline = R.offline.reloaded && R.offline.hasApp && /Zoe/.test(R.offline.title);
ok.noErrors = !R.errors.length;
// pinned data caching is checked with the service worker's own rule (the test server serves the catalog through a route, not the real CDN)
const sw = fs.readFileSync(ROOT + 'sw.js', 'utf8'); ok.pinnedDataRule = /zoescolleges-data@\[0-9a-f\]\{7,40\}/.test(sw) && /trim\(DATA, 8\)/.test(sw);
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./app-feel-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
