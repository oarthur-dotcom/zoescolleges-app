// Deploy bundle (Oct 13): private income, photo delete rules, stars-only Talk It Out, pricing honesty, Ask AI menu, Trips time + Maps.
// Run: CHROME=/path/to/chrome node tests/deploy-bundle-test.mjs   (demo family — nothing touches the real database)
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(d); }); }).listen(8914);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const R = {}; const errs = [];
async function boot(w){ const page = await b.newPage({ viewport: { width: w, height: 844 }, hasTouch: w<800, isMobile: w<800 }); page.on('pageerror', e => errs.push(w+': '+String(e)));
  await page.goto('http://localhost:8914/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800); return page; }
for (const W of [390, 1280]) {
  const page = await boot(W); const K = R['w'+W] = {};
  K.chanceLabels = await page.evaluate(() => ({ reach: bandLabel('reach') === 'Reach', target: bandLabel('target') === 'Target', likely: bandLabel('likely') === 'Likely', boardNoUndefined: (goto('board'), renderBoard(), !/undefined/.test(document.getElementById('v-board').innerText) && /Reach|Target|Likely/.test(document.getElementById('v-board').innerText)) }));
  // ---------- income privacy: KID ----------
  await page.evaluate(() => { state.me = { ...state.me, role: 'student' }; state.fin = { income: 190000, band: 4, kids: 1, exact: false }; goto('cost'); renderCost(); }); await page.waitForTimeout(500);
  K.kid = await page.evaluate(() => { const t = document.getElementById('v-cost').innerText; const h = document.getElementById('v-cost').innerHTML;
    return { noIncomeInput: !document.getElementById('cf-income'), noSave: !document.getElementById('cf-save'), saysAdjusted: /adjusted for your family/i.test(t), noNumber: !/190,?000|\$190k|190k/.test(t+h), noBandRange: !/110k\+|Over \$110k|\$110k/.test(t), noSAI: !/Student Aid Index/i.test(t),
      label: (() => { const y = yourNet(catInfo(state.schools[0].school_id)); return y ? y.label : 'none'; })() }; });
  // kid compare/board labels
  K.kidBandLabel = await page.evaluate(() => incomeBandText(4));
  // kid cannot save
  K.kidSaveNoop = await page.evaluate(async () => { let called = false; const real = sb; DEMO = false; state.family = state.family || { id: 'f' }; sb = { from: () => ({ upsert: async () => { called = true; return {}; } }) }; await saveFinance({ income: 1 }); sb = real; DEMO = true; return !called; });
  // ---------- income privacy: PARENT ----------
  await page.evaluate(() => { state.me = { ...state.me, role: 'parent' }; state.fin = { income: 190000, band: 4, kids: 2, exact: true }; goto('profile'); renderProfile(); }); await page.waitForTimeout(500);
  K.parent = await page.evaluate(() => { const i = document.getElementById('pf-family-money').querySelector('#cf-income'); const t = document.getElementById('pf-family-money').innerText; return { input: !!i && i.value === '190,000', saysParentsOnly: /only parents/i.test(t) }; });
  K.parentCosts = await page.evaluate(() => { goto('cost'); renderCost(); const t = document.getElementById('v-cost').innerText; return { noFormOnCosts: !document.querySelector('#v-cost #cf-income'), linkToProfile: !!document.querySelector('[data-cf-profile]'), noNumber: !/190,?000/.test(t) }; });
  K.kidProfile = await page.evaluate(() => { state.me = { ...state.me, role: 'student' }; state.fin = { income: 190000, band: 4, kids: 1, exact: false }; goto('profile'); renderProfile(); const e = document.getElementById('pf-family-money'); return { noInput: !e.querySelector('#cf-income'), private: /private to your parents/i.test(e.innerText), noNumber: !/190/.test(e.innerText) }; });
  await page.evaluate(() => { state.me = { ...state.me, role: 'parent' }; });
  K.parentSave = await page.evaluate(async () => { const calls = []; const real = sb; DEMO = false; state.family = { id: 'fam1' }; state.me = { ...state.me, user_id: 'u1', role: 'parent' };
    state.prefs = state.prefs || {}; state.prefs['u1'] = { ...defaultPrefs(), incomeExact: 99000, incomeBand: 3, kidsInCollege: 1 };
    sb = { from: t => ({ upsert: async r => { calls.push({ t, r }); return {}; } }) }; await setFamilyFinance(240000, 3); sb = real; DEMO = true;
    const c = calls.find(x => x.t === 'family_finance'); const pf = calls.find(x => x.t === 'preferences');
    return { saved: !!c && c.r.income_exact === 240000 && c.r.kids === 3 && c.r.band === 4 && c.r.user_id === 'u1', prefsStripped: !pf || !/incomeExact|incomeBand|kidsInCollege/.test(JSON.stringify(pf.r.weights)) }; });
  // ---------- photo delete rules ----------
  K.photoRules = await page.evaluate(() => { state.me = { ...state.me, user_id: 'me1', role: 'student' }; const mine = { id: 'p1', user_id: 'me1' }, theirs = { id: 'p2', user_id: 'dad' };
    const kid = [canDelPhoto(mine), canDelPhoto(theirs)]; state.me = { ...state.me, role: 'parent' }; const par = [canDelPhoto(mine), canDelPhoto(theirs)]; return { kidOwnOnly: kid[0] && !kid[1], parentAny: par[0] && par[1] }; });
  const sid = await page.evaluate(() => state.schools[0].school_id);
  await page.evaluate(sid => { state.me = { ...state.me, user_id: 'me1', role: 'student' }; state.photos = [{ id: 'a', school_id: sid, user_id: 'me1', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, { id: 'b', school_id: sid, user_id: 'dad', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }]; visitId = sid; goto('visit'); renderVisitKit(); }, sid); await page.waitForTimeout(500);
  K.visitStrip = await page.evaluate(() => ({ kidSees: document.querySelectorAll('[data-vkdel]').length })); // expect 1 (own only)
  await page.evaluate(() => { state.me = { ...state.me, role: 'parent' }; renderVisitKit(); });
  K.visitStripParent = await page.evaluate(() => ({ parentSees: document.querySelectorAll('[data-vkdel]').length })); // expect 2
  // delete failing server-side must not remove the file
  K.removeGuard = await page.evaluate(async () => { const rem = []; const real = sb; DEMO = false; state.photos = [{ id: 'z', path: 'f/x.jpg' }]; let alerted = false; window.alert = () => { alerted = true; };
    sb = { from: () => ({ delete: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }), storage: { from: () => ({ remove: async p => { rem.push(p); } }) } };
    const ok = await removePhoto('z'); sb = real; DEMO = true; return { refused: ok === false && alerted && rem.length === 0 }; });
  // ---------- Talk It Out: stars-only ----------
  await page.evaluate(() => { state.me = { ...state.me, role: 'parent' }; });
  K.talk = await page.evaluate(() => { const sc = state.schools[0].school_id; const ms = state.members; state.ratings = [{ school_id: sc, user_id: ms[0].user_id, rating: 5 }, { school_id: sc, user_id: ms[1] ? ms[1].user_id : 'x', rating: 2 }];
    if (ms.length < 2) state.members = [...ms, { user_id: 'x', display_name: 'Zed', role: 'student' }];
    talk.view = 'home'; goto('talk'); renderTalk(); const t = document.getElementById('talk-out').innerText;
    return { noFamilyVote: !/Family vote/i.test(t), disagree: /rated these differently/i.test(t), jumpBtn: !!document.querySelector('[data-tkjump]'), starsAreVote: /star ratings are your vote/i.test(document.getElementById('talk-intro').innerText) }; });
  K.noInviteSubtab = await page.evaluate(() => { goto('talk'); return !document.querySelector('#subnav .sn-act') && !/\+ Invite family/.test(document.getElementById('subnav').innerText); });
  K.noTheirs = await page.evaluate(() => { goto('board'); renderBoard(); return !/theirs/.test(document.getElementById('v-board').innerText) && !document.querySelector('.lock'); });
  K.navTitles = await page.evaluate(() => { goto('board'); const t = [...document.querySelectorAll('#subnav [data-nav]')].map(x => x.title); return t.length > 0 && t.every(x => x && x.length > 8); });
  // ---------- detail: pricing honesty + Ask AI ----------
  await page.evaluate(sid => { openDetail(sid, 'board'); }, sid); await page.waitForTimeout(700);
  K.detail = await page.evaluate(() => { const n = document.getElementById('price-note'); return { note: !!n && /College Scorecard/.test(n.innerText) && /higher/.test(n.innerText), reqBtn: !!document.querySelector('[data-pricereq]'), askAi: !!document.querySelector('#v-detail [data-askai], [data-askai]') }; });
  K.priceReq = await page.evaluate(async () => { const calls = []; const real = sb; DEMO = false; state.me = { ...state.me, user_id: 'u1' }; state.family = { id: 'fam1' }; sb = { from: t => ({ insert: async r => { calls.push({ t, r }); return { error: null }; } }) };
    await requestPricing('abc'); sb = real; DEMO = true; const m = document.getElementById('price-req-msg'); return { inserted: calls.length === 1 && calls[0].t === 'pricing_requests' && calls[0].r.school_id === 'abc', says72: !!m && /72 hours/.test(m.textContent) }; });
  // Ask AI menu
  K.askAi = await page.evaluate(async () => { const b = document.querySelector('[data-askai]'); b.click(); await new Promise(r => setTimeout(r, 200)); const m = document.querySelector('.ai-menu'); if (!m) return { menu: false };
    const items = [...m.querySelectorAll('.ai-mi')].map(x => x.textContent); const gpt = m.querySelector('[data-aiurl*="chatgpt.com"]'), cl = m.querySelector('[data-aiurl*="claude.ai"]');
    const q = gpt ? decodeURIComponent(gpt.dataset.aiurl.split('?q=')[1]) : ''; const out = { menu: true, four: items.length === 4, gpt: !!gpt && gpt.dataset.aiurl.startsWith('https://chatgpt.com/?q='), claude: !!cl && cl.dataset.aiurl.startsWith('https://claude.ai/new?q='), noIncome: !/190|240000|income \$|\$\d+k income/.test(q), hasSchool: q.length > 60 };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); out.escCloses = !document.querySelector('.ai-menu'); return out; });
  // ---------- Trips ----------
  await page.evaluate(sid => { const v = getVisit(sid); v.date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10); v.wish = false; v.past = false; saveVisit(sid, v); goto('trip'); renderTrip(); }, sid); await page.waitForTimeout(600);
  K.trip = await page.evaluate(async sid => { const inp = document.querySelector(`[data-tvtime="${sid}"]`); if (!inp) return { timeInput: false }; inp.value = '14:30'; inp.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400));
    const shown = /2:30 PM/.test(document.querySelector('.tv-meta').innerText); const maps = [...document.querySelectorAll('.near-cat')].filter(a => /google\.com\/maps\/search/.test(a.href)).length; const ai = !!document.querySelector('#v-trip [data-askai]');
    let ics = ''; const realBlob = window.Blob; window.Blob = function (p, o) { ics += p.join(''); return new realBlob(p, o); }; icsFor([{ id: sid, v: getVisit(sid), info: catInfo(sid) }], 'x.ics'); window.Blob = realBlob;
    return { timeInput: true, persisted: getVisit(sid).time === '14:30', shown, mapsLinks: maps, aiBtn: ai, icsAt1430: /DTSTART:\d{8}T\d{4}00Z/.test(ics) && new Date(ics.match(/DTSTART:(\S+)/)[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')).getHours() === 14 }; }, sid);
  // ---------- compare / essay / decide / pulse have the menu ----------
  K.more = await page.evaluate(() => { const ids = state.schools.slice(0, 2).map(s => s.school_id); ids.forEach(id => cmpSel[id] = true); goto('compare'); buildCompare(); const cmp = !!document.querySelector('#cmp-out [data-askai]');
    goto('decide'); renderDecide(); const dec = !!document.querySelector('#decide-out [data-askai]'); return { cmp, dec }; });
  await page.close();
}
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]);
const bad = flat(R).filter(([k, v]) => typeof v === 'boolean' ? !v : false);
const counts = flat(R).filter(([k]) => /kidSees|parentSees|mapsLinks/.test(k));
const countsOk = counts.every(([k, v]) => k.endsWith('kidSees') ? v === 1 : k.endsWith('parentSees') ? v === 2 : v === 6);
console.log(JSON.stringify({ R, errs }, null, 1)); console.log('FAILED:', bad.map(x => x[0]).join(', ') || 'none', '| counts ok:', countsOk, '| pageerrors:', errs.length);
await b.close(); srv.close(); process.exit(bad.length || !countsOk || errs.length ? 1 : 0);
