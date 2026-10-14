// Every suggestion chip Zoe shows must answer locally (no "bigger than my little brain" handoff).
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':f.endsWith('.html')?'text/html':'text/javascript'}); r.end(d); }); }).listen(8917);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const page = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:8917/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
const res = await page.evaluate(() => { const qs = new Set([...ZOE_SUGG, ...Object.values(ZOE_PAGE_SUGG).flat()].filter(x => x !== 'How does this page work?')); const out = []; for (const q of qs) { let a; try { a = zoeAnswer(q); } catch (e) { a = 'ERR ' + e; } out.push({ q, ok: a !== ZOE_FALLBACK && !/^ERR/.test(String(a)) && String(a).length > 20, a: String(a).slice(0, 60) }); } return out; });
const bad = res.filter(r => !r.ok); console.log(res.length + ' chips; failing:', JSON.stringify(bad, null, 1)); console.log('FAILED:', bad.length ? bad.map(x => x.q).join(' | ') : 'none', '| pageerrors:', errs.length);
await b.close(); srv.close(); process.exit(0);
