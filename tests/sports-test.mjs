// Sports (#80, Oct 12): division/conference chips, school-page Sports section, "Play in college?" in Profile activities,
// "My sport" Search filter + division filter, fit counts the team, Compare row, Zoe context, Pulse Sports tab.
// Run: node tests/sports-test.mjs   (needs /home/claude/zoescolleges-data/athletics.json from the fix/80 branch)
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const APP = new URL('..', import.meta.url).pathname;
const SITE = '/tmp/claude-0/spt/site', SHOTS = '/tmp/claude-0/spt/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(APP + 'index.html', SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json'), ATH = fs.readFileSync('/home/claude/zoescolleges-data/athletics.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8843);
const ok = {}, R = {};
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {});
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*athletics\.json/, r => r.fulfill({ contentType: 'application/json', body: ATH }));
  await page.route(/tile\.openstreetmap|router\.project-osrm|wikimedia/, r => r.abort());
  await page.route(/functions\/campus-pulse/, r => { const ids = (new URL(r.request().url()).searchParams.get('ids') || '').split(',').filter(Boolean); const today = new Date().toISOString().slice(0, 10);
    const schools = Object.fromEntries(ids.map((id, i) => [id, { stories: i === 0 ? [{ title: "Women's soccer wins the conference opener", link: 'https://news.example.edu/a', date: today, topic: 'Sports', kind: 'news' }, { title: 'New library opens', link: 'https://news.example.edu/b', date: today, topic: 'Campus life', kind: 'news' }] : [] }]));
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ schools, none: [] }) }); });
  let aiBody = null; await page.route(/functions\/zoe-ai/, async r => { aiBody = JSON.parse(r.request().postData() || '{}'); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'ok' }) }); });
  await page.goto('http://localhost:8843/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && state.schools && state.schools.length > 2 && state.athletics, null, { timeout: 60000 }); await page.waitForTimeout(600);
  const o = {};
  // board chips
  await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
  o.boardChips = await page.evaluate(() => ({ cards: document.querySelectorAll('#schools .school').length, chips: document.querySelectorAll('#schools .ath-chip').length, sample: (document.querySelector('#schools .ath-chip') || {}).textContent }));
  // known school: Williams = NCAA D3 · NESCAC
  const W = await page.evaluate(() => state.catalog.find(c => c.name === 'Williams College')?.id);
  o.williams = await page.evaluate(id => athShort(catInfo(id)), W);
  // no athlete yet: no team lines
  o.noGoalLines = await page.evaluate(() => document.querySelectorAll('#schools .my-team').length);
  // the parent's view of the student profile is read-only, so set the student's activity directly here (the editor UI is tested below as the student)
  await page.evaluate(() => { const stu = state.members.find(m => m.role === 'student'); const key = stu ? stu.user_id : 'pending'; state.profiles[key] = state.profiles[key] || {}; state.profiles[key].activities = [{ category: 'Athletics: JV/Varsity', sport: 'Soccer', position: 'Captain', tier: 3, college: 'yes', team: 'w', collegeLevel: 'D3' }]; });
  o.colSel = o.teamSel = true;
  o.goal = await page.evaluate(() => athleteGoal());
  // fit moves: a D3 school with women's soccer vs a school with none
  o.fit = await page.evaluate(() => { const g = athleteGoal(); const pool = state.catalog.filter(c => c.scorecard && c.degreeType === '4-year');
    const has = pool.find(c => athleteFit(c, g) === 1), none = pool.find(c => athleteFit(c, g) === 0);
    const w = myPrefs(); return { has: has && has.name, none: none && none.name, hasLine: has && myTeamLine(has), noneLine: none && myTeamLine(none) }; });
  // board shows my-team lines now
  await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
  o.goalLines = await page.evaluate(() => document.querySelectorAll('#schools .my-team').length);
  await page.screenshot({ path: `${SHOTS}${label}-board.png` });
  // Search: My sport + D3
  await page.evaluate(() => goto('explore')); await page.waitForTimeout(600);
  o.mySportOpt = await page.evaluate(() => [...document.querySelectorAll('#ex-sport option')].slice(0, 2).map(x => x.textContent));
  await page.selectOption('#ex-sport', 'Soccer|w'); await page.selectOption('#ex-div', 'D3'); await page.waitForTimeout(600);
  o.search = await page.evaluate(() => { const rows = [...document.querySelectorAll('#exlist .srow')]; return { n: rows.length, allD3: rows.every(r => /NCAA D3/.test(r.innerText)), allTeam: rows.every(r => r.querySelector('.my-team.yes')), count: document.getElementById('excount').innerText }; });
  await page.screenshot({ path: `${SHOTS}${label}-search.png` });
  await page.selectOption('#ex-sport', ''); await page.selectOption('#ex-div', '');
  // school page
  await page.evaluate(id => openDetail(id, 'explore'), W); await page.waitForTimeout(600);
  o.detail = await page.evaluate(() => { const c = document.querySelector('.sports-card'); return c ? { top: c.querySelector('.sp-top').innerText, mine: c.querySelectorAll('.sp-t.mine').length, links: [...c.querySelectorAll('.sp-links a')].map(a => a.textContent), myTeam: (c.querySelector('.my-team') || {}).innerText } : null; });
  await page.locator('.sports-card').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}${label}-detail.png` });
  // Zoe gets athlete + school athletics
  await page.evaluate(() => { window.scrollTo(0, 0); document.body.classList.remove('fab-tuck'); }); await page.waitForTimeout(400);
  await page.click('#zoe-fab'); await page.waitForTimeout(300); await page.fill('#zoe-in', 'Could I play soccer here?'); await page.press('#zoe-in', 'Enter'); await page.waitForTimeout(1000);
  o.zoe = aiBody && { athlete: aiBody.ctx.athlete, school: aiBody.ctx.page && aiBody.ctx.page.school && { athletics: aiBody.ctx.page.school.athletics, myTeam: aiBody.ctx.page.school.myTeam } };
  await page.click('#zoe-close');
  // Pulse sports tab always present
  await page.evaluate(() => goto('pulse')); await page.waitForTimeout(800);
  o.pulseTab = await page.evaluate(() => !!document.querySelector('[data-pt-view="sports"]'));
  if (o.pulseTab) { await page.click('[data-pt-view="sports"]'); await page.waitForTimeout(400); o.pulseTeams = await page.evaluate(() => document.querySelectorAll('.pt-teams a').length); o.pulseSports = await page.evaluate(() => ({ n: document.querySelectorAll('.pt-tile').length })); await page.screenshot({ path: `${SHOTS}${label}-pulse.png` }); }
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; R[label] = o; await b.close();
  ok[label + '.boardChips'] = o.boardChips.chips >= o.boardChips.cards - 1 && o.boardChips.chips > 0;
  ok[label + '.williamsD3Nescac'] = /NCAA D3 · New England Small College Athletic/.test(o.williams || '');
  ok[label + '.noTeamLinesWithoutGoal'] = o.noGoalLines === 0;
  ok[label + '.profilePlayInCollege'] = o.colSel && o.teamSel && o.goal && o.goal.sport === 'Soccer' && o.goal.side === 'w' && o.goal.level === 'D3' && o.goal.serious === true;
  ok[label + '.fitAndTeamLines'] = !!o.fit.has && !!o.fit.none && /✓ Women(&#39;|')s soccer/.test(o.fit.hasLine) && /No women(&#39;|')s soccer team/.test(o.fit.noneLine) && o.goalLines > 0;
  ok[label + '.searchMySport'] = /My sport: women's soccer/.test(o.mySportOpt[1] || '') && o.search.n > 0 && o.search.allD3 && o.search.allTeam;
  ok[label + '.detailSports'] = o.detail && /NCAA D3/.test(o.detail.top) && o.detail.mine >= 1 && o.detail.links.some(t => /recruiting questionnaire/.test(t)) && /✓/.test(o.detail.myTeam || '');
  ok[label + '.zoeKnowsSport'] = !!(o.zoe && o.zoe.athlete && o.zoe.athlete.sport === 'Soccer' && /D3/.test(o.zoe.school.athletics || '') && /has a women's soccer team/.test(o.zoe.school.myTeam || ''));
  ok[label + '.pulseSportsTab'] = o.pulseTab === true && o.pulseTeams > 0 && o.pulseSports && o.pulseSports.n === 1;
  ok[label + '.noErrors'] = !o.errors.length;
}
// Profile editor as the student: "Play in college?" → Team + Level appear, and save onto the activity
{ const SITE2 = '/tmp/claude-0/spt/site2'; fs.mkdirSync(SITE2, { recursive: true }); fs.copyFileSync(APP + 'index.html', SITE2 + '/index.html');
  const srv2 = http.createServer((q, r) => { const f = path.join(SITE2, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8845);
  const b = await launch(); const { page, log } = await newPage(b, { width: 390, height: 844 }, {});
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
  await page.route(/jsdelivr.*athletics\.json/, r => r.fulfill({ contentType: 'application/json', body: ATH }));
  await page.goto('http://localhost:8845/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length && state.me, null, { timeout: 60000 }); await page.waitForTimeout(600);
  await page.evaluate(() => { state.me = state.members.find(m => m.role === 'student'); goto('profile'); }); await page.waitForTimeout(400);   // sign in as the student
  await page.evaluate(() => { const e = document.querySelector('[data-pf-edit]'); if (e) e.click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { profActs = [{ category: 'Athletics: JV/Varsity', sport: 'Soccer', position: 'Captain', tier: 3, grades: ['10', '11'], hrs: 12, weeks: 30, timing: 'During school year' }]; actOpen = 0; actDirty = true; renderActs(); });
  const u = {}; u.before = await page.evaluate(() => ({ col: !!document.querySelector('.act-card.open .act-college .a-col'), team: !!document.querySelector('.act-card.open .a-team') }));
  await page.locator('.act-card.open .a-col').scrollIntoViewIfNeeded(); await page.selectOption('.act-card.open .a-col', 'yes'); await page.waitForTimeout(200);
  u.after = await page.evaluate(() => ({ team: !!document.querySelector('.act-card.open .a-team'), lvl: !!document.querySelector('.act-card.open .a-clvl'), tip: !!document.querySelector('.act-college-tip') }));
  await page.selectOption('.act-card.open .a-team', 'w'); await page.selectOption('.act-card.open .a-clvl', 'D3');
  await page.screenshot({ path: `${SHOTS}phone-profile.png` });
  u.saved = await page.evaluate(() => ({ college: profActs[0].college, team: profActs[0].team, lvl: profActs[0].collegeLevel }));
  u.errors = log.pageerr; R.profileUI = u; await b.close(); srv2.close();
  ok['profileUI.playInCollegeFields'] = u.before.col && !u.before.team && u.after.team && u.after.lvl && u.after.tip && u.saved.college === 'yes' && u.saved.team === 'w' && u.saved.lvl === 'D3' && !u.errors.length; }
srv.close();
const allPass = Object.values(ok).every(Boolean);
fs.writeFileSync(new URL('./sports-result-2026-10-12.json', import.meta.url), JSON.stringify({ ok, R }, null, 1));
console.log(JSON.stringify(ok, null, 1)); console.log(JSON.stringify({ allPass }));
