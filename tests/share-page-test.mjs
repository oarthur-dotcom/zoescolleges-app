// #56 Share with grandparents or a counselor. Run: node tests/share-page-test.mjs
import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f56/site', SHOTS = '/tmp/claude-0/f56/'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8818);
const R = {}, ok = {};
const boot = async (page, q = '') => { await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT })); await page.route(/tile\.openstreetmap|router\.project-osrm/, r => r.abort());
  await page.goto('http://localhost:8818/index.html' + q); };
for (const [label, vp, dark] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }], ['phone-dark', { width: 390, height: 844 }, true]]) {
  const b = await launch(); const { page, log } = await newPage(b, vp, {}); if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await boot(page); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0 && state.me && state.schools.length, null, { timeout: 60000 }); await page.waitForTimeout(800);
  const o = {};
  // private things that must never leak into a link
  await page.evaluate(() => { const sid = state.schools[0].school_id; const r = state.ratings.find(x => x.school_id === sid && x.user_id === state.me.user_id); if (r) { r.note = 'SECRET-NOTE-xyz'; r.rating = 4; } else state.ratings.push({ school_id: sid, user_id: state.me.user_id, rating: 4, note: 'SECRET-NOTE-xyz' });
    offersSet({ [sid]: { coa: 81234, grants: [{ amt: 11111 }], loans: [] } }); localStorage.removeItem('zc_my_shares'); });
  // entry points
  o.todayBtn = await page.evaluate(() => !!document.querySelector('#td-out [data-td-share]'));
  await page.evaluate(() => goto('board')); await page.waitForTimeout(200); await page.click('#btn-more'); await page.waitForTimeout(100);
  o.menuBtn = await page.isVisible('#btn-sharelist'); await page.click('#btn-sharelist'); await page.waitForTimeout(300);
  o.dialog = await page.evaluate(() => ({ auds: document.querySelectorAll('[data-shaud]').length, on: document.querySelector('[data-shaud].on').dataset.shaud, parts: [...document.querySelectorAll('[data-shpart]')].map(c => c.dataset.shpart + ':' + c.checked).join(',') }));
  await page.screenshot({ path: `${SHOTS}${label}-dialog.png` });
  // counselor defaults flip academics on, stars off
  await page.click('[data-shaud="counselor"]'); await page.waitForTimeout(100);
  o.counselorParts = await page.evaluate(() => [...document.querySelectorAll('[data-shpart]')].map(c => c.dataset.shpart + ':' + c.checked).join(','));
  await page.click('[data-shaud="family"]'); await page.check('[data-shpart="costs"]');
  await page.fill('#sh-note', 'Hi Grandma! <img src=x onerror="window.__x=1"> Michigan is the favorite');
  await page.click('#sh-prev'); await page.waitForTimeout(300);
  o.preview = await page.evaluate(() => { const p = document.querySelector('.share-preview'); return { text: p.innerText.slice(0, 2000), stars: p.querySelectorAll('.share-stars').length, cta: !!p.querySelector('.share-cta'), xss: !!p.querySelector('img') || !!window.__x }; });
  await page.screenshot({ path: `${SHOTS}${label}-preview.png`, fullPage: false });
  await page.click('[data-pvx]'); await page.waitForTimeout(100);
  await page.click('#sh-make'); await page.waitForTimeout(500);
  o.made = await page.evaluate(() => { const w = window.__writes.filter(x => x.table === 'shares' && x.op === 'insert').pop(); const url = (document.querySelector('#sh-url') || {}).value || '';
    return { url, payload: w && w.p.payload, row: w && { kind: w.p.kind, fam: w.p.family_id === state.family.id, by: w.p.created_by === state.session.user.id, tokLen: w.p.token.length }, mine: myShares().length, list: document.querySelectorAll('.share-mrow').length, sms: !!document.querySelector('a[href^="sms:"]'), mail: !!document.querySelector('a[href^="mailto:"]') }; });
  const pj = JSON.stringify(o.made.payload || {});
  o.leak = { note: pj.includes('SECRET-NOTE'), offer: pj.includes('81234') || pj.includes('11111'), income: /income/i.test(pj), email: /@/.test(pj) };
  await page.screenshot({ path: `${SHOTS}${label}-made.png` });
  // turn off: before migration 013 the fake DB returns no rows -> honest message, link kept in list
  await page.click('[data-shoff]'); await page.waitForTimeout(400);
  o.offBefore = await page.evaluate(() => ({ msg: (document.querySelector('#sh-mine .share-made') || {}).textContent || '', mine: myShares().length }));
  // after migration 013 (owner can read own rows) delete returns the row
  await page.evaluate(() => { const f = sb.from.bind(sb); sb.from = t => { const q = f(t); if (t !== 'shares') return q; const d = q.delete; q.delete = () => { d(); const s = q.select; q.select = () => ({ then: (res, rej) => q.then(() => res({ data: [{ token: 'x' }], error: null }), rej) }); return q; }; return q; }; });
  await page.click('[data-shoff]'); await page.waitForTimeout(400);
  o.offAfter = await page.evaluate(() => ({ mine: myShares().length, rows: document.querySelectorAll('.share-mrow').length, del: window.__writes.filter(x => x.table === 'shares' && x.op === 'delete').length }));
  // counselor payload content
  o.counselor = await page.evaluate(() => { const p = boardSharePayload({ audience: 'counselor', include: { academics: true, deadlines: true } }); const h = renderShareHtml(p); return { hasAcad: !!p.academics, acts: (p.academics.activities || []).length, gpa: p.academics.gpa, hasStars: p.schools.some(s => s.stars != null), html: /Academic snapshot/.test(h) && /Print/.test(h) }; });
  o.anyone = await page.evaluate(() => { const p = boardSharePayload({ audience: 'anyone', include: {} }); return { acad: !!p.academics, cost: p.schools.some(s => s.cost != null), dl: p.schools.some(s => s.deadline), stars: p.schools.some(s => s.stars != null) }; });
  o.audit = await audit(page, 'body'); o.errors = log.pageerr; await b.close();
  // public page: old-format share still renders (backward compatible)
  const b2 = await launch(); const { page: p2, log: l2 } = await newPage(b2, vp, {}); await boot(p2, '?share=abc123'); await p2.waitForSelector('.share-row', { timeout: 30000 }); await p2.waitForTimeout(300);
  o.publicOld = await p2.evaluate(() => ({ h1: document.querySelector('#share-body h1').textContent, rows: document.querySelectorAll('.share-row').length, nav: !document.querySelector('#appnav') || document.querySelector('#appnav').classList.contains('hidden') }));
  await p2.screenshot({ path: `${SHOTS}${label}-public.png`, fullPage: true }); o.audit2 = await audit(p2, 'body'); o.errors2 = l2.pageerr; await b2.close();
  R[label] = o;
  ok[label + '.entryPoints'] = o.todayBtn && o.menuBtn && o.dialog.auds === 3 && o.dialog.on === 'family';
  ok[label + '.audienceDefaults'] = o.dialog.parts === 'stars:true,deadlines:true,costs:false,academics:false' && o.counselorParts === 'stars:false,deadlines:true,costs:false,academics:true';
  ok[label + '.previewShowsWhatTheyGet'] = /Where .* is looking/.test(o.preview.text) && /Hi Grandma!/.test(o.preview.text) && o.preview.stars >= 1 && /after aid/.test(o.preview.text) && !o.preview.cta;
  ok[label + '.noteEscaped'] = !o.preview.xss;
  ok[label + '.linkCreated'] = /\?share=[a-z0-9]{24}$/.test(o.made.url) && o.made.row.kind === 'list' && o.made.row.fam && o.made.row.by && o.made.payload.v === 2 && o.made.payload.audience === 'family' && o.made.mine === 1 && o.made.list === 1 && o.made.sms && o.made.mail;
  ok[label + '.nothingPrivateLeaks'] = !o.leak.note && !o.leak.offer && !o.leak.income && !o.leak.email;
  ok[label + '.turnOffHonestBefore013'] = /migration 013/.test(o.offBefore.msg) && o.offBefore.mine === 1;
  ok[label + '.turnOffWorksAfter013'] = o.offAfter.mine === 0 && o.offAfter.rows === 0 && o.offAfter.del >= 2;
  ok[label + '.counselorView'] = o.counselor.hasAcad && o.counselor.html && !o.counselor.hasStars;
  ok[label + '.anyoneIsMinimal'] = !o.anyone.acad && !o.anyone.cost && !o.anyone.dl && !o.anyone.stars;
  ok[label + '.oldLinksStillWork'] = /Arthur Family/.test(o.publicOld.h1) && o.publicOld.rows === 1 && o.publicOld.nav;
  ok[label + '.noErrors'] = !o.errors.length && !o.errors2.length; ok[label + '.noSidewaysScroll'] = !o.audit.overflowX && !o.audit2.overflowX;
}
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
fs.writeFileSync(new URL('./share-page-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1)); srv.close();
