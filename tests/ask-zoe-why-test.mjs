// "Why is X a reach / why did it change" goes to Zoe's AI with the app's reasoning. Run: node tests/ask-zoe-why-test.mjs
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
process.env.GEMINI_API_KEY = 'test-key'; let geminiBody = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => { url = String(url);
  if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1' }), { status: 200 });
  if (url.includes('generativelanguage')) { geminiBody = JSON.parse(opts.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }); }
  return realFetch(url, opts); };
const zoe = (await import('../netlify/functions/zoe-ai.mjs')).default;
const ROOT = new URL('..', import.meta.url).pathname;
const server = await zoe(new Request('https://zoescolleges.com/x', { method: 'POST', headers: { origin: 'https://zoescolleges.com', 'content-type': 'application/json', authorization: 'Bearer GOOD' },
  body: JSON.stringify({ q: 'why is Ithaca a reach?', ctx: { bandReasons: [{ school: 'Ithaca College', band: 'Reach', inputs: { gpaRaw: '3.4', sat: 1200, testOptional: false }, steps: [{ k: 'Admit rate', v: 'Target', why: '70% admitted' }, { k: 'GPA', v: 'Reach', why: 'Below typical' }] }] } }) }));
const sys = geminiBody && geminiBody.systemInstruction.parts[0].text;
const R = { serverStatus: server.status, sysHasReasons: /bandReasons/.test(sys) && /Below typical/.test(sys) && /Ithaca College/.test(sys), sysHasRule: /BAND QUESTIONS/.test(sys) };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8912);
const b = await chromium.launch({ executablePath: process.env.CHROME }); const page = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:8912/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
await page.evaluate(() => { DEMO = false; window.__aiCalls = []; const rf = window.fetch; window.fetch = async (u, o) => { if (String(u).includes('zoe-ai')) { window.__aiCalls.push(JSON.parse(o.body)); return new Response(JSON.stringify({ reply: 'AI says: ' + 'because of the GPA step' }), { status: 200 }); } return rf(u, o); }; });
const name = await page.evaluate(() => state.schools[0].name);
const ask = async q => page.evaluate(async q => { window.__aiCalls.length = 0; document.getElementById('zoe-log').innerHTML = ''; await zoeHandle(q); return { calls: window.__aiCalls.slice(), log: document.getElementById('zoe-log').innerText }; }, q);
const a1 = await ask(`Why is ${name} a reach?`); const a2 = await ask('Why did my reaches change?'); const a3 = await ask('What are my reaches?'); const a4 = await ask('My targets'); const a5 = await ask('why did it change');
const first = a1.calls[0]; R.why1 = { n: a1.calls.length, school: first && first.ctx.bandReasons && first.ctx.bandReasons[0].school, steps: first && first.ctx.bandReasons[0].steps.length, answer: /AI says/.test(a1.log) };
R.why2 = { n: a2.calls.length, schools: a2.calls[0] && a2.calls[0].ctx.bandReasons.length };
R.plainReach = { n: a3.calls.length, canned: /Your reaches|reaches/i.test(a3.log) && !/AI says/.test(a3.log) };
R.plainTarget = { n: a4.calls.length };
R.vague = { n: a5.calls.length };
const ok = { serverPassesReasons: R.serverStatus === 200 && R.sysHasReasons && R.sysHasRule, whyAboutSchoolUsesAI: R.why1.n === 1 && R.why1.school === name && R.why1.steps >= 3 && R.why1.answer,
  whyGeneralUsesAI: R.why2.n === 1 && R.why2.schools >= 1, plainReachStillInstant: R.plainReach.n === 0 && R.plainReach.canned, plainTargetInstant: R.plainTarget.n === 0, noErrors: errs.length === 0 };
console.log(JSON.stringify({ R, ok, errs }, null, 1), Object.values(ok).every(Boolean)); await b.close(); srv.close();
