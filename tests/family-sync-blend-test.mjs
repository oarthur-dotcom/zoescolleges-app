// Per-person fit + family blend, and rankings that follow the person. Run: node tests/family-sync-blend-test.mjs
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8915);
const R = {}, ok = {};
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const b = await chromium.launch({ executablePath: process.env.CHROME }); const page = await b.newPage({ viewport: vp }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:8915/index.html'); await page.waitForFunction(() => typeof startDemo === 'function' && document.getElementById('demo-start'), null, { timeout: 60000 });
  await page.evaluate(() => startDemo()); await page.waitForFunction(() => state.me && state.catalog && state.catalog.length > 0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { DEMO = false; });
  const o = {};
  // three people with different priorities
  o.setup = await page.evaluate(async () => {
    const base = defaultPrefs(); const v = (o) => ({ ...base, ...o }); const keys = SLIDERS.map(s => s.key);
    const hi = v(Object.fromEntries(keys.map(k => [k, 100]))), lo = v(Object.fromEntries(keys.map(k => [k, 0]))), mid = v(Object.fromEntries(keys.map(k => [k, 50])));
    await sb.from('preferences').upsert({ user_id: 'demo-maya', family_id: 'demo-family', weights: mid }); await sb.from('preferences').upsert({ user_id: 'demo-mom', family_id: 'demo-family', weights: hi }); await sb.from('preferences').upsert({ user_id: 'demo-dad', family_id: 'demo-family', weights: lo });
    await loadPrefs(); return { people: Object.keys(state.prefs) }; });
  o.fit = await page.evaluate(() => { const out = []; for (const s of state.schools) { const info = catInfo(s.school_id); const f = famFit(info); if (f) out.push({ id: s.school_id, rows: f.rows.length, fam: f.fam, spread: f.spread, talk: f.talk, mean: Math.round(f.rows.reduce((a, r) => a + r.m, 0) / f.rows.length), you: f.rows.find(r => r.name === 'You') && f.rows.find(r => r.name === 'You').m, own: matchScore(info, state.prefs[state.me.user_id]) }); } return out; });
  o.dom = await page.evaluate(async () => { goto('board'); renderBoard(); await new Promise(r => setTimeout(r, 300)); const el = document.querySelector('[data-famfit]'); return el ? el.innerText : null; });
  o.single = await page.evaluate(() => { const keep = state.prefs; state.prefs = { [state.me.user_id]: keep[state.me.user_id] }; const f = famFit(catInfo(state.schools[0].school_id)); state.prefs = keep; return f; });
  // ranks follow the person
  o.ranks = await page.evaluate(async () => {
    const ids = state.schools.slice(0, 3).map(s => s.school_id); const me = state.me.user_id; const out = {};
    lsSet('ranks', { [ids[0]]: 2, [ids[1]]: 1 });     // an old device-only ranking
    await loadRanks(); const afterUpload = (await sb.from('school_ranks').select('*')).data.filter(r => r.user_id === me).map(r => [r.school_id, r.rank]).sort();
    out.uploaded = JSON.stringify(afterUpload) === JSON.stringify([[ids[0], 2], [ids[1], 1]].sort());
    await setRank(ids[2], 3); out.savedNew = (await sb.from('school_ranks').select('*')).data.some(r => r.user_id === me && r.school_id === ids[2] && r.rank === 3);
    await setRank(ids[2], null); out.removed = !(await sb.from('school_ranks').select('*')).data.some(r => r.user_id === me && r.school_id === ids[2]);
    out.noFamilyYet = JSON.stringify(familyRankMap());
    // another family member ranks on another device
    await sb.from('school_ranks').upsert([{ user_id: 'demo-mom', family_id: 'demo-family', school_id: ids[0], rank: 1 }, { user_id: 'demo-mom', family_id: 'demo-family', school_id: ids[1], rank: 3 }]);
    await syncShared(true); const fm = familyRankMap(); out.family = fm; out.ids = ids;   // ids[0]: avg(2,1)=1.5 -> #1 ; ids[1]: avg(1,3)=2 -> #2
    rankMode = true; renderBoard(); await new Promise(r => setTimeout(r, 200)); out.badge = [...document.querySelectorAll('.famrank')].map(e => e.textContent);
    // table missing -> falls back to this device
    const real = sb.from; sb.from = t => t === 'school_ranks' ? { select() { return Promise.resolve({ data: null, error: { message: 'relation "school_ranks" does not exist', code: '42P01' } }); }, upsert() { return Promise.resolve({ error: { message: 'relation does not exist', code: '42P01' } }); }, delete() { return { eq() { return { eq() { return Promise.resolve({ error: { message: 'relation does not exist', code: '42P01' } }); } }; } }; } } : real(t);
    await loadRanks(); await setRank(ids[0], 5); out.fallback = getRanks()[ids[0]] === 5 && BACKEND.ranks === false; sb.from = real; BACKEND.ranks = true; return out; });
  o.err = errs; await b.close(); R[label] = o;
  const L = label;
  ok[L + '.threePeople'] = o.setup.people.length === 3;
  ok[L + '.blendIsEqualAverage'] = o.fit.length > 0 && o.fit.every(f => f.rows === 3 && f.fam === f.mean && f.you === f.own);
  ok[L + '.talkFlagAt12'] = o.fit.every(f => f.talk === (f.spread >= 12)) && o.fit.some(f => f.talk);
  ok[L + '.shownOnBoard'] = !!o.dom && /You/.test(o.dom) && /Family \d+%/.test(o.dom);
  ok[L + '.hiddenWhenAlone'] = o.single === null;
  ok[L + '.oldRanksUploaded'] = o.ranks.uploaded; ok[L + '.rankSaved'] = o.ranks.savedNew; ok[L + '.rankRemoved'] = o.ranks.removed;
  ok[L + '.noFamilyRankWithOnePerson'] = o.ranks.noFamilyYet === '{}';
  ok[L + '.familyRankFromAverages'] = o.ranks.family[o.ranks.ids[0]] === 1 && o.ranks.family[o.ranks.ids[1]] === 2 && o.ranks.badge.length >= 2 && /Family #1/.test(o.ranks.badge.join(' '));
  ok[L + '.fallsBackToDevice'] = o.ranks.fallback;
  ok[L + '.noErrors'] = !o.err.length;
}
console.log(JSON.stringify({ ok }, null, 1), Object.values(ok).every(Boolean)); srv.close();
