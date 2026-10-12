// #65 Step 1 fixes. Run: node tests/step1-fixes-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f65/site', SHOTS = '/tmp/claude-0/f65/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8902);
// a big photo (~6MB PNG of noise) to prove phone photos are shrunk before upload
const BIG = '/tmp/claude-0/f65/big-transcript.png';
const R = {}, ok = {};
const open = async (b, vp, init, dark) => { const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' }); await page.addInitScript(init || '');
  await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8902/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(700); return { page, log }; };
const contrast = (fg, bg) => { const L = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; }; const a = L(fg), b2 = L(bg); return (Math.max(a, b2) + .05) / (Math.min(a, b2) + .05); };
{ const b = await launch(); const { page } = await newPage(b, { width: 400, height: 300 }, {});
  await page.setContent('<canvas id=c width=2400 height=3200></canvas>'); const d = await page.evaluate(() => { const c = document.getElementById('c'), x = c.getContext('2d'), im = x.createImageData(2400, 3200); for (let i = 0; i < im.data.length; i++) im.data[i] = (Math.random() * 255) | 0; x.putImageData(im, 0, 0); return c.toDataURL('image/png'); });
  fs.writeFileSync(BIG, Buffer.from(d.split(',')[1], 'base64')); await b.close(); }
R.bigBytes = fs.statSync(BIG).size;
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const o = {};
  // A. Parent alone with their OWN grades filled in, no student: nothing may use the parent's grades as the student's
  { const { page, log } = await open(b, vp, 'window.__NOSTUDENT=true;', dark);
    o.leak = await page.evaluate(() => ({ sp: studentProfile(), report: reportStudentName(), note: anchorNoteHtml(), chance: (()=>{ const c=state.catalog.find(x=>x.id==='college-of-charleston'); const e=chanceExplain(c); return JSON.stringify(e||{}); })() }));
    o.copyBox = await page.evaluate(() => !!document.querySelector('#ss-copy'));
    await page.fill('#ss-name', 'Zoe'); await page.click('#ss-save'); await page.waitForTimeout(500);
    o.insertNoCopy = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'pending_students' && x.op === 'insert').pop(); return w && Object.keys(w.p.profile).length; });
    o.inputStyled = await page.evaluate(() => { const i = document.createElement('input'); document.body.appendChild(i); const cs = getComputedStyle(i); const r = { pad: cs.paddingTop, bg: cs.backgroundColor, color: cs.color }; i.remove(); return r; });
    // Set priorities from the welcome checklist
    const go = await page.$('[data-ns-step="prios"]'); o.prioBtn = !!go; if (go) { await go.click(); await page.waitForTimeout(500); }
    o.prio = await page.evaluate(() => ({ view: currentView, whoShown: !document.getElementById('pf-who').classList.contains('hidden'), acadHidden: document.getElementById('pf-acad').classList.contains('hidden'), whose: document.getElementById('pr-whose').innerText, h: document.getElementById('pr-h').textContent }));
    await page.screenshot({ path: `${SHOTS}${label}-priorities.png` });
    o.errA = log.pageerr; }
  // B. Transcript: big photo is shrunk; empty read is honest; good read shows the courses; readable in dark mode
  { const { page, log } = await open(b, vp, '', dark);
    let sentMime = null, sentLen = 0, mode = 'empty';
    await page.route('**/.netlify/functions/transcript-read', async r => { const j = JSON.parse(r.request().postData() || '{}'); sentMime = j.mime; sentLen = (j.file || '').length;
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify(mode === 'empty' ? { empty: true } : { fields: { gpa: 3.8, gpaScale: 4, apIb: 1, honors: 6, dualEnrollment: 0, sat: null, act: null, confidence: 'high', courses: [{ name: 'English 10 Honors', level: 'Honors' }, { name: 'AP Biology', level: 'AP' }] } }) }); });
    await page.evaluate(() => { goto('profile'); profileTab('acad'); pfEdit = true; renderProfileView(); }); await page.waitForTimeout(300);
    await page.setInputFiles('#tx-file', BIG); await page.waitForTimeout(2500);
    o.tx1 = await page.evaluate(() => document.getElementById('tx-status').innerText); o.sent = { mime: sentMime, kb: Math.round(sentLen * 0.75 / 1024) };
    mode = 'good'; await page.setInputFiles('#tx-file', BIG); await page.waitForTimeout(2500);
    o.tx2 = await page.evaluate(() => { const p = document.getElementById('tx-preview'); const cs = getComputedStyle(p); return { text: p.innerText, fg: cs.color, bg: cs.backgroundColor, courses: p.querySelectorAll('.txp-courses li').length }; });
    o.txContrast = contrast(o.tx2.fg, o.tx2.bg);
    await page.evaluate(() => { const d = document.querySelector('.txp-courses'); if (d) d.open = true; document.getElementById('tx-preview').scrollIntoView(); }); await page.screenshot({ path: `${SHOTS}${label}-transcript.png` });
    o.btnContrast = await page.evaluate(() => { const b = document.querySelector('button.primary'); const cs = getComputedStyle(b); return [cs.color, cs.backgroundColor]; }); o.btnRatio = contrast(o.btnContrast[0], o.btnContrast[1]);
    // Talk wording + floating buttons
    o.words = await page.evaluate(() => [peopleList(['Zoe', 'you']), peopleList(['you', 'Zoe', 'Usha']), peopleList(['Obie'])]);
    await page.evaluate(() => goto('board')); await page.waitForTimeout(500);
    o.fabDesk = await page.evaluate(() => getComputedStyle(document.getElementById('zoe-fab')).display);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); await page.mouse.wheel(0, 900); await page.waitForTimeout(500);
    o.tucked = await page.evaluate(() => document.body.classList.contains('fab-tuck'));
    await page.mouse.wheel(0, -300); await page.waitForTimeout(500); o.back = await page.evaluate(() => !document.body.classList.contains('fab-tuck'));
    o.audit = await audit(page, 'body'); o.errB = log.pageerr; }
  // C. With the student in the family, "whose priorities" is clear and her profile is used
  { const { page, log } = await open(b, vp, '', dark); await page.evaluate(() => openPriorities()); await page.waitForTimeout(400);
    o.whoseStudent = await page.evaluate(() => document.getElementById('pr-whose').innerText); o.errC = log.pageerr; }
  await b.close(); R[label] = o;
  ok[label + '.noParentGradeLeak'] = o.leak.sp === null && o.leak.report === '' && /No student yet/.test(o.leak.note) && !/1300|3\.7/.test(o.leak.chance);
  ok[label + '.askBeforeCopyingParentGrades'] = o.copyBox && o.insertNoCopy === 0;
  ok[label + '.plainInputsStyled'] = parseFloat(o.inputStyled.pad) >= 8 && o.inputStyled.bg !== 'rgba(0, 0, 0, 0)';
  ok[label + '.setPrioritiesOpensSliders'] = o.prioBtn && o.prio.view === 'profile' && o.prio.whoShown && o.prio.acadHidden && /yours \(Obie\)/.test(o.prio.whose) && /\(Obie\)/.test(o.prio.h);
  ok[label + '.photoShrunk'] = o.sent.mime === 'image/jpeg' && o.sent.kb < 2500;
  ok[label + '.emptyReadHonest'] = /couldn't find grades or courses/i.test(o.tx1);
  ok[label + '.readShowsCourses'] = o.tx2.courses === 2 && /Honors courses\s*6/.test(o.tx2.text);
  ok[label + '.transcriptReadable'] = o.txContrast >= 7;
  ok[label + '.buttonsReadable'] = o.btnRatio >= 4.5;
  ok[label + '.naturalWording'] = o.words[0] === 'you and Zoe' && o.words[1] === 'you, Zoe and Usha' && o.words[2] === 'Obie';
  ok[label + '.floatingButtons'] = vp.width >= 900 ? o.fabDesk === 'none' : (o.tucked && o.back);
  ok[label + '.whosePrioritiesWithStudent'] = /yours \(Obie\)/.test(o.whoseStudent) && /Zoe sets/.test(o.whoseStudent);
  ok[label + '.noErrors'] = !o.errA.length && !o.errB.length && !o.errC.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./step1-fixes-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
