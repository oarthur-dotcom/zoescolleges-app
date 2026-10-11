// #44 profile check: impossible numbers refused; a parent wrongly marked as the student can switch back. Run: node tests/profile-check-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f44/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8806);
const b = await launch(); const { page, log } = await newPage(b, { width: 390, height: 844 }, {});
await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
await page.goto('http://localhost:8806/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me, null, { timeout: 60000 }); await page.waitForTimeout(700);
const o = {};
o.validation = await page.evaluate(() => [{ gpa: '9.9' }, { sat: '2400' }, { act: '99' }, { home_state: 'XX' }, { gpa: '3.7', sat: '1300', act: '', home_state: 'MA' }].map(p => profileProblems(p) || 'OK'));
// Obie's real situation: his own member row ("Dad") is marked as the student
o.before = await page.evaluate(() => { const me = state.members.find(m => m.user_id === state.me.user_id); me.display_name = 'Dad'; me.role = 'student'; state.members.find(m => m.user_id !== state.me.user_id).role = 'parent'; return anchorNoteHtml().replace(/<[^>]+>/g, ''); });
await page.evaluate(() => { window.confirm = () => true; document.body.insertAdjacentHTML('beforeend', `<div id="t-note">${anchorNoteHtml()}</div>`); document.querySelector('#t-note [data-setparent]').click(); });
await page.waitForTimeout(800);
o.roleWrite = await page.evaluate(() => JSON.stringify(window.__writes.filter(w => w.table === 'members' && w.op === 'update').map(w => w.p)));
o.errors = log.pageerr;
const ok = { refusesGpa: /GPA/.test(o.validation[0]), refusesSat: /SAT/.test(o.validation[1]), refusesAct: /ACT/.test(o.validation[2]), refusesState: /state/.test(o.validation[3]), acceptsGood: o.validation[4] === 'OK',
  offersSwitch: /Dad.*Switch me to parent/.test(o.before), switchWritesParent: o.roleWrite === '[{"role":"parent"}]', noErrors: !o.errors.length };
const out = { o, ok, allPass: Object.values(ok).every(Boolean) }; console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('./profile-check-result-2026-10-11.json', import.meta.url), JSON.stringify(out, null, 1)); await b.close(); srv.close();
