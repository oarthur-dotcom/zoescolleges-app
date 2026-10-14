// Zoe v2 (Oct 13): no server AI, personality, AI handoff, 2 cards, full-width chat, Today guide links.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(d); }); }).listen(8915);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const R = {}; const errs = [];
for (const W of [390, 1280]) {
  const page = await b.newPage({ viewport: { width: W, height: 844 } }); page.on('pageerror', e => errs.push(W+': '+e));
  const zoeCalls = []; page.on('request', q => { if (/zoe-ai/.test(q.url())) zoeCalls.push(q.url()); });
  await page.goto('http://localhost:8915/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const K = R['w'+W] = {};
  await page.evaluate(() => { goto('zoe'); }); await page.waitForTimeout(400);
  K.cards = await page.evaluate(() => { const c=[...document.querySelectorAll('.zm-card')].map(x=>x.dataset.zm); const g=document.querySelector('.zm-cards').getBoundingClientRect(), ch=document.querySelector('.ztab-chat').getBoundingClientRect();
    return { cards: c, noEssayHuddle: !c.includes('essay') && !c.includes('huddle'), widthMatch: Math.abs(g.width-ch.width) <= 2, g: Math.round(g.width), ch: Math.round(ch.width), greeting: /Goose/.test(document.getElementById('ztab-log').innerText) }; });
  const qs = ['What are my reaches?', 'When are my deadlines?', 'What should I work on?', 'Plan my week', 'Write my Common App essay about my grandmother', 'Compare the best engineering programs in the Midwest for me', 'Who won the Red Sox game last night?', 'Is my list balanced?'];
  K.answers = [];
  for (const q of qs) { await page.evaluate(q => { document.getElementById('ztab-in').value = q; document.getElementById('ztab-form').requestSubmit(); }, q); await page.waitForTimeout(700);
    K.answers.push(await page.evaluate(() => { const m=[...document.querySelectorAll("#ztab-log .zmsg.z:not(.ztyping)")].pop(); return { html:m.innerHTML.slice(0,120), len:(m.innerText||'').length, hasAI: !!m.querySelector('.ai-btn'), bad: /AI service|Try again|trouble reaching/i.test(m.innerText) }; })); }
  K.noBad = K.answers.every(a => a.len > 10 && !a.bad);
  K.beyondGetsAI = K.answers.slice(4,7).every(a => a.hasAI); K.localOnes = [2,3].every(i => !K.answers[i].hasAI);
  K.noServerCalls = zoeCalls.length === 0;
  await page.evaluate(() => { document.querySelector('[data-zm="stack"]').click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('zm-stack-go').click(); }); await page.waitForTimeout(700);
  K.stack = await page.evaluate(() => { const m=[...document.querySelectorAll('#ztab-log .zmsg.z')].pop(); return { len:(m.innerText||'').length, bad:/AI service|Try again/i.test(m.innerText) }; });
  // Today guide
  await page.evaluate(() => { try{ localStorage.removeItem('zc_howto'); }catch(e){} goto('today'); document.getElementById('howto').classList.remove('hidden'); }); await page.waitForTimeout(400);
  K.guide = await page.evaluate(() => { const h=document.getElementById('howto'); const links=[...h.querySelectorAll('[data-td-go]')].map(a=>a.dataset.tdGo); const li=h.querySelectorAll('ol li').length; return { links, li, hasClose: !!document.getElementById('howto-x2') }; });
  await page.evaluate(() => document.querySelector('#howto [data-td-go="profile"]').click()); await page.waitForTimeout(400);
  K.guideGoesProfile = await page.evaluate(() => currentView === 'profile');
  await page.evaluate(() => { goto('today'); document.getElementById('howto').classList.remove('hidden'); document.getElementById('howto-x2').click(); });
  K.guideClose = await page.evaluate(() => document.getElementById('howto').classList.contains('hidden'));
  K.btnOffset = await page.evaluate(() => { const b=document.querySelector('#v-today .howto-btn'); return b ? getComputedStyle(b).marginLeft : 'none'; });
  await page.close();
}
const fails = []; for (const [w,K] of Object.entries(R)) { if(!K.cards.noEssayHuddle||K.cards.cards.length!==2) fails.push(w+' cards'); if(!K.cards.widthMatch) fails.push(w+' width'); if(!K.cards.greeting) fails.push(w+' greeting'); if(!K.noBad) fails.push(w+' badAnswer'); if(!K.beyondGetsAI) fails.push(w+' noAIbtn'); if(!K.localOnes) fails.push(w+' workOn/week not local'); if(!K.noServerCalls) fails.push(w+' serverCall'); if(K.stack.len<10||K.stack.bad) fails.push(w+' stack'); if(K.guide.li!==5||!['profile','explore','board','invite'].every(x=>K.guide.links.includes(x))||!K.guide.hasClose) fails.push(w+' guide'); if(!K.guideGoesProfile) fails.push(w+' guideNav'); if(!K.guideClose) fails.push(w+' guideClose'); }
console.log(JSON.stringify(R, null, 1)); console.log('FAILED:', fails.length ? fails.join(', ') : 'none', '| pageerrors:', errs.length, errs.slice(0,3));
await b.close(); srv.close(); process.exit(0);
