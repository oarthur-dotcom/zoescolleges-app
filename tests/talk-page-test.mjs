// #60 Talk It Out, #62 sleek redesign. Run: node tests/talk-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f62/site', SHOTS = '/tmp/claude-0/f62/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
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
  await page.click('[data-td-talk="home"]'); await page.waitForTimeout(400);
  o.view = await page.evaluate(() => currentView);
  o.home = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.tk-trow')].map(x => x.innerText.replace(/\s+/g, ' ')), vote: (document.querySelector('.tk-votecard') || {}).innerText || '', tabs: document.querySelectorAll('.tk-tab,[role=tab]').length, intro: !document.querySelector('#talk-intro').classList.contains('hidden'), checkbox: document.querySelectorAll('#talk-out input[type=checkbox]').length }));
  await page.screenshot({ path: `${SHOTS}${label}-home.png`, fullPage: false });
  await page.click('[data-tkopen="college-of-charleston"]'); await page.waitForTimeout(300);
  o.thread0 = await page.evaluate(() => ({ title: (document.querySelector('.tk-htitle') || {}).textContent, introHidden: document.querySelector('#talk-intro').classList.contains('hidden'), chips: document.querySelectorAll('.tk-chip,.tk-feelbtn,.tk-starter').length, checkbox: document.querySelectorAll('#talk-out input[type=checkbox]').length, nudge: (document.querySelector('.tk-nudge') || {}).innerText || '' }));
  await page.selectOption('#tk-feel', 'worry');
  await page.fill('#tk-text', 'I hate the humidity and you never listen'); await page.waitForTimeout(200);
  o.kind = await page.evaluate(() => [...document.querySelectorAll('#tk-kind .tk-kindrow')].map(x => x.innerText));
  await page.click('[data-tkuse="0"]'); await page.waitForTimeout(100); await page.click('[data-tkuse="0"]'); await page.waitForTimeout(100);
  o.afterUse = await page.inputValue('#tk-text'); o.kindAfter = await page.evaluate(() => document.querySelectorAll('#tk-kind .tk-kindrow').length);
  await page.click('#tk-words'); await page.waitForTimeout(150);
  o.starters = await page.evaluate(() => document.querySelectorAll('[data-tkstart]').length);
  const keep = o.afterUse;
  await page.click('[data-tkstart]'); await page.waitForTimeout(100); o.blank = await page.inputValue('#tk-text'); o.startersClosed = await page.evaluate(() => document.querySelector('#tk-starters').classList.contains('hidden'));
  await page.click('#tk-save'); await page.waitForTimeout(200); o.blankMsg = await page.textContent('#tk-msg');
  await page.fill('#tk-text', keep); await page.click('#tk-save'); await page.waitForTimeout(600);
  o.saved = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'talk_posts' && x.op === 'insert').pop(); return w && { kind: w.p.kind, feel: w.p.feel, school: w.p.school_id, body: w.p.body, movie: w.p.in_movie }; });
  o.shown = await page.evaluate(() => ({ mine: [...document.querySelectorAll('.tk-msgrow.me .tk-bub')].map(x => x.innerText.replace(/\s+/g, ' ')), text: document.querySelector('#tk-text').value, feel: document.querySelector('#tk-feel').value }));
  // Zoe shares; Obie reacts from the ⋯ menu
  await page.evaluate(async (u2) => { await sb.from('talk_posts').insert({ id: 'zp1', family_id: state.family.id, user_id: u2, school_id: 'college-of-charleston', kind: 'voice', feel: 'love', body: 'Downtown felt like my kind of place.', in_movie: true, created_at: new Date().toISOString() }); await loadTalk(); renderTalk(); }, UID2); await page.waitForTimeout(300);
  o.menuHidden = await page.evaluate(() => !document.querySelector('[data-tkreact]'));
  await page.click('[data-tkmenu="zp1"]'); await page.waitForTimeout(150);
  await page.click('[data-tkreact="zp1|heard"]'); await page.waitForTimeout(400);
  o.react = await page.evaluate(() => ({ w: window.__writes.filter(x => x.table === 'talk_reactions' && x.op === 'insert').length, count: [...document.querySelectorAll('[data-post="zp1"] .tk-rc')].map(x => x.textContent).join(' '), menuClosed: !document.querySelector('[data-tkreact]') }));
  await page.screenshot({ path: `${SHOTS}${label}-thread.png`, fullPage: false });
  // reply, then agree from a post
  await page.click('[data-tkmenu="zp1"]'); await page.click('[data-tkreply="zp1"]'); await page.waitForTimeout(200);
  o.replyMode = await page.evaluate(() => (document.querySelector('.tk-mode') || {}).innerText || '');
  await page.fill('#tk-text', 'I hear you. Could we visit in March?'); await page.click('#tk-save'); await page.waitForTimeout(500);
  await page.click('[data-tkmenu="zp1"]'); await page.click('[data-tkagreeon="zp1"]'); await page.waitForTimeout(200);
  o.agreePrefill = await page.inputValue('#tk-text'); o.agreeFeelHidden = await page.evaluate(() => !document.querySelector('#tk-feel'));
  await page.fill('#tk-text', 'We keep Charleston and visit in March.'); await page.click('#tk-save'); await page.waitForTimeout(500);
  o.thread = await page.evaluate(() => ({ bubbles: document.querySelectorAll('.tk-msgrow').length, quotes: document.querySelectorAll('.tk-quote').length, agree: document.querySelectorAll('.tk-agreed').length,
    rows: window.__writes.filter(x => x.table === 'talk_posts' && x.op === 'insert').map(x => x.p.kind + ':' + (x.p.reply_to ? 'reply' : '') + ':' + x.p.school_id + ':' + x.p.in_movie) }));
  // leave my own words out of the movie
  const myId = await page.evaluate(() => talk.posts.filter(p => p.user_id === state.me.user_id && p.kind === 'voice').pop().id);
  await page.click(`[data-tkmenu="${myId}"]`); await page.click(`[data-tkmovie="${myId}"]`); await page.waitForTimeout(400);
  o.movieOff = await page.evaluate((id) => ({ db: talk.posts.find(p => p.id === id).in_movie, label: (document.querySelector(`[data-post="${id}"] .tk-under`) || {}).innerText || '' }), myId);
  await page.screenshot({ path: `${SHOTS}${label}-agreed.png`, fullPage: false });
  // back to home: row shows activity and dots
  await page.click('.tk-back'); await page.waitForTimeout(250);
  o.homeAfter = await page.evaluate(() => ({ first: (document.querySelector('.tk-trow') || {}).innerText || '', dotsOn: document.querySelectorAll('.tk-trow:first-child .tk-dot.on').length }));
  // vote
  await page.click('.tk-votecard'); await page.waitForTimeout(300);
  for (const id of ['sc-166683', 'college-of-charleston', 'university-of-vermont']) { await page.click(`[data-tkpick="${id}"]`); await page.waitForTimeout(80); }
  await page.click('[data-tkup="1"]'); await page.waitForTimeout(80);
  await page.screenshot({ path: `${SHOTS}${label}-vote.png`, fullPage: false });
  await page.click('#tk-vote'); await page.waitForTimeout(600);
  o.after1 = await page.evaluate(() => ({ status: (document.querySelector('.tk-status') || {}).innerText || '', hidden: !document.querySelector('.tk-results'), mine: ballot.mine && ballot.mine.ranks }));
  await page.evaluate(async (u2) => { await sb.from('family_ballots').upsert({ user_id: u2, family_id: state.family.id, ranks: ['sc-166683', 'college-of-charleston'], submitted_at: new Date().toISOString() }); await loadBallot(); renderTalk(); }, UID2); await page.waitForTimeout(400);
  o.results = await page.evaluate(() => ({ pick: (document.querySelector('.tk-pick') || {}).innerText || '', rows: [...document.querySelectorAll('.tk-res')].map(x => x.innerText.replace(/\s+/g, ' ')), talkBtns: document.querySelectorAll('[data-tktalkabout]').length }));
  await page.screenshot({ path: `${SHOTS}${label}-results.png`, fullPage: false });
  await page.click('#tk-newround'); await page.click('#tk-newround'); await page.waitForTimeout(500);
  o.newRound = await page.evaluate(() => ({ voted: ballot.res && ballot.res.voted, form: !!document.querySelector('#tk-vote') }));
  // moments
  await page.click('.tk-back'); await page.waitForTimeout(200); await page.click('.tk-foot [data-tkgoto="moments"]'); await page.waitForTimeout(300);
  o.moments = await page.evaluate(() => ({ n: document.querySelectorAll('.tk-moment').length, agree: document.querySelectorAll('.tk-moment.agreement').length }));
  // whole-family conversation
  await page.click('.tk-back'); await page.waitForTimeout(200); await page.click('[data-tkopen=""]'); await page.waitForTimeout(200);
  o.family = await page.evaluate(() => ({ title: (document.querySelector('.tk-htitle') || {}).textContent, ph: document.querySelector('#tk-text').placeholder }));
  await page.fill('#tk-text', 'Can we talk about money this weekend?'); await page.click('#tk-save'); await page.waitForTimeout(400);
  o.familySaved = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'talk_posts' && x.op === 'insert').pop(); return w && (w.p.school_id === null && w.p.kind === 'post'); });
  // school page block
  await page.evaluate(() => openDetail('college-of-charleston')); await page.waitForTimeout(400);
  o.detail = await page.evaluate(() => (document.querySelector('.tk-detail') || {}).innerText || '');
  await page.click('[data-talkgo]'); await page.waitForTimeout(300); o.detailGo = await page.evaluate(() => currentView + '|' + talkSchool + '|' + talkTab);
  // XSS
  await page.evaluate(async (u2) => { await sb.from('talk_posts').insert({ id: 'x1', family_id: state.family.id, user_id: u2, school_id: 'college-of-charleston', kind: 'voice', feel: 'love', body: '<img src=x onerror="window.__xss=1">', in_movie: true, created_at: new Date().toISOString() }); await loadTalk(); renderTalk(); talkTab = 'home'; renderTalk(); }, UID2); await page.waitForTimeout(300);
  o.xss = await page.evaluate(() => !!window.__xss || !!document.querySelector('#talk-out img'));
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close();
  // sample family
  const b2 = await launch(); const { page: p2, log: l2 } = await newPage(b2, vp, { signedOut: true }); await boot(p2); await p2.waitForTimeout(2500);
  await p2.evaluate(() => startDemo()); await p2.waitForTimeout(2500); await p2.evaluate(() => goto('talk')); await p2.waitForTimeout(500);
  o.demo = await p2.evaluate(() => ({ rows: document.querySelectorAll('.tk-trow').length, vote: (document.querySelector('.tk-votecard') || {}).innerText || '' }));
  await p2.click('.tk-trow'); await p2.waitForTimeout(300); o.demoThread = await p2.evaluate(() => ({ bubbles: document.querySelectorAll('.tk-msgrow').length, agree: document.querySelectorAll('.tk-agreed').length }));
  await p2.screenshot({ path: `${SHOTS}${label}-demo.png` }); o.errors2 = l2.pageerr; await b2.close();
  R[label] = o;
  ok[label + '.todayCard'] = /talk it out/i.test(o.todayCard) && /Waiting to hear from|Everyone has shared/.test(o.todayCard) && o.view === 'talk';
  ok[label + '.homeIsAList'] = o.home.rows.length >= 4 && o.home.tabs === 0 && o.home.checkbox === 0 && /Family vote/.test(o.home.vote) && o.home.intro && o.home.rows.some(r => /whole family/i.test(r));
  ok[label + '.threadIsCalm'] = /Charleston/.test(o.thread0.title) && o.thread0.introHidden && o.thread0.chips === 0 && o.thread0.checkbox === 0 && /Waiting to hear from Zoe/.test(o.thread0.nudge);
  ok[label + '.kindWords'] = o.kind.length === 1 && /you never listen/.test(o.kind[0]) && /\+1 more/.test(o.kind[0]) && o.afterUse === "I'm not drawn to the humidity and I'd love to feel heard about this" && o.kindAfter === 0;
  ok[label + '.starters'] = o.starters === 4 && /___/.test(o.blank) && o.startersClosed && /Fill in the blank/.test(o.blankMsg);
  ok[label + '.voiceSaved'] = o.saved && o.saved.kind === 'voice' && o.saved.feel === 'worry' && o.saved.school === 'college-of-charleston' && o.saved.movie === true && o.shown.mine.some(t => /not drawn to/.test(t) && /worried/.test(t)) && o.shown.text === '' && o.shown.feel === '';
  ok[label + '.reactions'] = o.menuHidden && o.react.w === 1 && /💛 1/.test(o.react.count) && o.react.menuClosed;
  ok[label + '.replyAndAgree'] = /Replying to Zoe/.test(o.replyMode) && o.agreePrefill === 'Downtown felt like my kind of place.' && o.agreeFeelHidden && o.thread.quotes === 1 && o.thread.agree === 1 && o.thread.rows.slice(-2).join(',') === 'post:reply:college-of-charleston:true,agreement::college-of-charleston:true';
  ok[label + '.leaveOutOfMovie'] = o.movieOff.db === false && /not in movie/.test(o.movieOff.label);
  ok[label + '.homeShowsActivity'] = /College of Charleston/.test(o.homeAfter.first) && o.homeAfter.dotsOn === 2;
  ok[label + '.ballotSecretUntilAllVote'] = /1 of 2/.test(o.after1.status) && o.after1.hidden && JSON.stringify(o.after1.mine) === '["college-of-charleston","sc-166683","university-of-vermont"]';
  ok[label + '.ballotResults'] = /Family pick/.test(o.results.pick) && o.results.rows.length === 3 && o.results.rows.some(r => /Obie #1/.test(r) && /Zoe #2/.test(r));
  ok[label + '.newRound'] = o.newRound.voted === 0 && o.newRound.form;
  ok[label + '.moments'] = o.moments.n >= 3 && o.moments.agree === 1;
  ok[label + '.wholeFamily'] = /whole family/i.test(o.family.title) && /on your mind/.test(o.family.ph) && o.familySaved;
  ok[label + '.schoolPage'] = /family voices/i.test(o.detail) && /Downtown felt like my kind of place/.test(o.detail) && o.detailGo === 'talk|college-of-charleston|thread';
  ok[label + '.escaped'] = !o.xss;
  ok[label + '.sampleFamily'] = o.demo.rows >= 3 && /2 of 3/.test(o.demo.vote) && o.demoThread.bubbles >= 2;
  ok[label + '.noErrors'] = !o.errors.length && !o.errors2.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./talk-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
