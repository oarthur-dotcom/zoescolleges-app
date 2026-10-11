// #60 Talk It Out. Run: node tests/talk-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f60/site', SHOTS = '/tmp/claude-0/f60/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8824);
const UID2 = '22222222-2222-2222-2222-222222222222';
const R = {}, ok = {};
const boot = async page => { await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort()); await page.goto('http://localhost:8824/index.html'); };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await boot(page); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && talk.loaded && ballot.loaded, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  o.todayCard = await page.evaluate(() => (document.querySelector('.td-talk') || {}).innerText || '');
  await page.click('[data-td-talk="voices"]'); await page.waitForTimeout(400);
  o.view = await page.evaluate(() => currentView);
  await page.click('[data-tkschool="college-of-charleston"]'); await page.waitForTimeout(200);
  await page.click('[data-tkfeel="worry"]'); await page.waitForTimeout(200);
  await page.fill('#tk-text', 'I hate the humidity and you never listen'); await page.waitForTimeout(200);
  o.kind = await page.evaluate(() => [...document.querySelectorAll('.tk-kindrow')].map(x => x.innerText));
  await page.click('[data-tkuse="0"]'); await page.waitForTimeout(100); await page.click('[data-tkuse="0"]'); await page.waitForTimeout(100);
  o.afterUse = await page.inputValue('#tk-text');
  await page.click('#tk-words'); await page.waitForTimeout(150);
  o.starters = await page.evaluate(() => document.querySelectorAll('[data-tkstart]').length);
  const keep = o.afterUse;
  await page.click('[data-tkstart]'); await page.waitForTimeout(100); o.blank = await page.inputValue('#tk-text');
  await page.click('#tk-save'); await page.waitForTimeout(200); o.blankMsg = await page.textContent('#tk-msg');
  await page.fill('#tk-text', keep); await page.click('#tk-save'); await page.waitForTimeout(600);
  o.saved = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'talk_posts' && x.op === 'insert').pop(); return w && { kind: w.p.kind, feel: w.p.feel, school: w.p.school_id, body: w.p.body, movie: w.p.in_movie }; });
  o.shown = await page.evaluate(() => [...document.querySelectorAll('.tk-person')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 140)));
  await page.screenshot({ path: `${SHOTS}${label}-voices.png`, fullPage: false });
  // Zoe shares; Obie reacts
  await page.evaluate(async (u2) => { await sb.from('talk_posts').insert({ id: 'zp1', family_id: state.family.id, user_id: u2, school_id: 'college-of-charleston', kind: 'voice', feel: 'love', body: 'Downtown felt like my kind of place.', in_movie: true, created_at: new Date().toISOString() }); await loadTalk(); renderTalk(); }, UID2); await page.waitForTimeout(300);
  await page.click('[data-tkreact="zp1|heard"]'); await page.waitForTimeout(400);
  o.react = await page.evaluate(() => ({ w: window.__writes.filter(x => x.table === 'talk_reactions' && x.op === 'insert').length, on: !!document.querySelector('[data-tkreact="zp1|heard"].on') }));
  // ballot
  await page.click('[data-tktab="ballot"]'); await page.waitForTimeout(300);
  for (const id of ['college-of-charleston', 'sc-166683', 'university-of-vermont']) { await page.click(`[data-tkpick="${id}"]`); await page.waitForTimeout(80); }
  await page.click('#tk-vote'); await page.waitForTimeout(600);
  o.after1 = await page.evaluate(() => ({ status: (document.querySelector('.tk-status') || {}).innerText || '', hidden: !document.querySelector('.tk-results'), mine: ballot.mine && ballot.mine.ranks }));
  await page.evaluate(async (u2) => { await sb.from('family_ballots').upsert({ user_id: u2, family_id: state.family.id, ranks: ['sc-166683', 'college-of-charleston'], submitted_at: new Date().toISOString() }); await loadBallot(); renderTalk(); }, UID2); await page.waitForTimeout(400);
  o.results = await page.evaluate(() => ({ pick: (document.querySelector('.tk-pick') || {}).innerText || '', rows: [...document.querySelectorAll('.tk-res')].map(x => x.innerText.replace(/\s+/g, ' ')), talkBtns: document.querySelectorAll('[data-tktalkabout]').length }));
  await page.screenshot({ path: `${SHOTS}${label}-ballot.png`, fullPage: false });
  await page.click('#tk-newround'); await page.click('#tk-newround'); await page.waitForTimeout(500);
  o.newRound = await page.evaluate(() => ({ voted: ballot.res && ballot.res.voted, form: !!document.querySelector('#tk-vote') }));
  // talk tab: post, reply, agreement
  await page.click('[data-tktab="talk"]'); await page.waitForTimeout(300);
  await page.selectOption('#tk-topic', 'college-of-charleston');
  await page.click('[data-tkprompt="What matters most to me is…"]'); await page.type('#tk-text', 'being close to a city.'); await page.click('#tk-save'); await page.waitForTimeout(500);
  await page.click('[data-tkreply]'); await page.waitForTimeout(200); await page.fill('#tk-text', 'I hear you. Could we visit in March?'); await page.click('#tk-save'); await page.waitForTimeout(500);
  await page.click('#tk-agree'); await page.waitForTimeout(200); await page.fill('#tk-text', 'We keep Charleston and visit in March.'); await page.click('#tk-save'); await page.waitForTimeout(500);
  o.thread = await page.evaluate(() => ({ posts: document.querySelectorAll('.tk-thread .tk-post').length, replies: document.querySelectorAll('.tk-thread .tk-post.reply').length, agree: document.querySelectorAll('.tk-thread .tk-post.agree').length,
    rows: window.__writes.filter(x => x.table === 'talk_posts' && x.op === 'insert').map(x => x.p.kind + ':' + (x.p.reply_to ? 'reply' : '') + ':' + x.p.school_id) }));
  await page.screenshot({ path: `${SHOTS}${label}-talk.png`, fullPage: false });
  await page.click('[data-tktab="moments"]'); await page.waitForTimeout(300);
  o.moments = await page.evaluate(() => ({ n: document.querySelectorAll('.tk-moment').length, agree: document.querySelectorAll('.tk-moment.agreement').length }));
  // school page block + delete own
  await page.evaluate(() => openDetail('college-of-charleston')); await page.waitForTimeout(400);
  o.detail = await page.evaluate(() => (document.querySelector('.tk-detail') || {}).innerText || '');
  await page.click('[data-talkgo]'); await page.waitForTimeout(300); o.detailGo = await page.evaluate(() => currentView + '|' + talkSchool + '|' + talkTab);
  // XSS
  await page.evaluate(async (u2) => { await sb.from('talk_posts').insert({ id: 'x1', family_id: state.family.id, user_id: u2, school_id: 'college-of-charleston', kind: 'voice', feel: 'love', body: '<img src=x onerror="window.__xss=1">', in_movie: true, created_at: new Date().toISOString() }); await loadTalk(); talkTab = 'voices'; renderTalk(); }, UID2); await page.waitForTimeout(300);
  o.xss = await page.evaluate(() => !!window.__xss || !!document.querySelector('#talk-out img'));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close();
  // sample family
  const b2 = await launch(); const { page: p2, log: l2 } = await newPage(b2, vp, { signedOut: true }); await boot(p2); await p2.waitForTimeout(2500);
  await p2.evaluate(() => startDemo()); await p2.waitForTimeout(2500); await p2.evaluate(() => goto('talk')); await p2.waitForTimeout(500);
  o.demo = await p2.evaluate(() => ({ voices: document.querySelectorAll('.tk-post').length }));
  await p2.click('[data-tktab="ballot"]'); await p2.waitForTimeout(300); o.demoBallot = await p2.evaluate(() => (document.querySelector('.tk-status') || {}).innerText || '');
  await p2.click('[data-tktab="talk"]'); await p2.waitForTimeout(300); o.demoAgree = await p2.evaluate(() => document.querySelectorAll('.tk-post.agree').length);
  await p2.screenshot({ path: `${SHOTS}${label}-demo.png` }); o.errors2 = l2.pageerr; await b2.close();
  R[label] = o;
  ok[label + '.todayCard'] = /talk it out/i.test(o.todayCard) && /Waiting to hear from|Everyone has shared/.test(o.todayCard) && o.view === 'talk';
  ok[label + '.kindWords'] = o.kind.length === 2 && /I hate/.test(o.kind.join('')) && o.afterUse === "I'm not drawn to the humidity and I'd love to feel heard about this";
  ok[label + '.starters'] = o.starters === 6 && /___/.test(o.blank) && /Fill in the blank/.test(o.blankMsg);
  ok[label + '.voiceSaved'] = o.saved && o.saved.kind === 'voice' && o.saved.feel === 'worry' && o.saved.school === 'college-of-charleston' && o.saved.movie === true && /not drawn to/.test(o.shown.join(' '));
  ok[label + '.reactions'] = o.react.w === 1 && o.react.on;
  ok[label + '.ballotSecretUntilAllVote'] = /1 of 2/.test(o.after1.status) && o.after1.hidden && JSON.stringify(o.after1.mine) === '["college-of-charleston","sc-166683","university-of-vermont"]';
  ok[label + '.ballotResults'] = /Family pick/.test(o.results.pick) && o.results.rows.length === 3 && o.results.rows.some(r => /Obie: #1/.test(r) && /Zoe: #2/.test(r));
  ok[label + '.newRound'] = o.newRound.voted === 0 && o.newRound.form;
  ok[label + '.talkThread'] = o.thread.posts >= 3 && o.thread.replies === 1 && o.thread.agree === 1 && o.thread.rows.slice(-3).join(',') === 'post::college-of-charleston,post:reply:college-of-charleston,agreement::college-of-charleston';
  ok[label + '.moments'] = o.moments.n >= 3 && o.moments.agree === 1;
  ok[label + '.schoolPage'] = /family voices/i.test(o.detail) && /Downtown felt like my kind of place/.test(o.detail) && o.detailGo === 'talk|college-of-charleston|voices';
  ok[label + '.escaped'] = !o.xss;
  ok[label + '.sampleFamily'] = o.demo.voices >= 2 && /2 of 3/.test(o.demoBallot) && o.demoAgree === 1;
  ok[label + '.noErrors'] = !o.errors.length && !o.errors2.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./talk-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
