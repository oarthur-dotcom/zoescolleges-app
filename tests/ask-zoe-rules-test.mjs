// Canned Ask Zoe answers only for clear short questions; everything else goes to the AI. Run: node tests/ask-zoe-rules-test.mjs
// Env: OLD=<path to previous index.html> to also show how the old version routed each question.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os';
const ROOT = new URL('..', import.meta.url).pathname; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zr-'));
const serve = (dir, port) => http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(port);
const AI = [  // must go to Zoe's AI (no canned answer)
  'What should I learn about financial aid?', "I'm worried about writing my essay", 'How do I write my essay about working at a fast food job?', 'Is a small school a good fit for a shy kid?',
  'How do I reach the admissions office at UVM?', 'Can I get in to a good school with a B average?',
  'Is it ok to apply in or out of state?', 'Suggest some essay topics',
  'Tell me what you think about my list because I keep going back and forth between big and small schools and my family disagrees about cost',
  'Should I work on my essay this weekend?', 'What is an essay supplement?', 'Where should I even start with the common app?' ];
const RULE = [  // must still get an instant canned answer
  'cheapest schools', 'most selective in Colorado', 'biggest schools', 'schools with early deadline', 'my targets', 'What are my reaches?', 'my likely schools', 'Is my list balanced?',
  'smallest schools in Vermont', 'highest earnings', 'highest graduation rate', 'How does this app work?', 'How do I invite my family?', 'What does net price mean?', 'How do I add photos?', 'Which are my best matches?',
  'Where does the data come from?', 'recommend some schools', 'How can I improve my chances?', 'How do ratings work?' ];
const run = async (file, port) => { const dir = path.join(tmp, 'p' + port); fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(file, dir + '/index.html'); fs.copyFileSync(ROOT + 'supabase-config.js', dir + '/supabase-config.js');
  const srv = serve(dir, port); const b = await chromium.launch({ executablePath: process.env.CHROME }); const page = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const out = await page.evaluate(qs => qs.map(q => [q, zoeAnswer(q) === ZOE_FALLBACK ? 'AI' : 'RULE']), [...AI, ...RULE]); await b.close(); srv.close(); return { out, errs }; };
const NEW = await run(ROOT + 'index.html', 8913); const OLD = process.env.OLD ? await run(process.env.OLD, 8914) : null;
const want = q => AI.includes(q) ? 'AI' : 'RULE'; const bad = NEW.out.filter(([q, r]) => r !== want(q)); const oldBad = OLD ? OLD.out.filter(([q, r]) => r !== want(q)).map(x => x[0]) : null;
console.log(JSON.stringify({ total: NEW.out.length, newMisrouted: bad, oldMisroutedCount: oldBad && oldBad.length, oldMisrouted: oldBad, errs: NEW.errs }, null, 1)); console.log('PASS', bad.length === 0 && !NEW.errs.length);
