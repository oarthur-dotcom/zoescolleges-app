// #41 search check: nicknames, exact names first, typos. Run: node tests/search-check-test.mjs
import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE = '/tmp/claude-0/f41/site'; fs.mkdirSync(SITE, { recursive: true }); fs.copyFileSync(new URL('../index.html', import.meta.url), SITE + '/index.html');
if (fs.existsSync('/tmp/claude-0/f20/site/supabase-config.js')) fs.copyFileSync('/tmp/claude-0/f20/site/supabase-config.js', SITE + '/supabase-config.js');
const CAT = fs.readFileSync('/tmp/claude-0/f35-colleges.json');
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); }).listen(8802);
const b = await launch(); const { page, log } = await newPage(b, { width: 1280, height: 900 }, {});
await page.route(/jsdelivr.*colleges\.json/, r => r.fulfill({ contentType: 'application/json', body: CAT }));
await page.goto('http://localhost:8802/index.html'); await page.waitForFunction(() => typeof state !== 'undefined' && state.catalog && state.catalog.length > 0, null, { timeout: 60000 });
const EXPECT = { 'MIT': 'Massachusetts Institute of Technology', 'mit': 'Massachusetts Institute of Technology', 'UVA': 'University of Virginia-Main Campus', 'UNC': 'University of North Carolina at Chapel Hill',
  'Charleston': 'College of Charleston', 'Harvard': 'Harvard University', 'Stanford': 'Stanford University', 'stanferd': 'Stanford University', 'vanderbelt': 'Vanderbilt University',
  'Georgetwon': 'Georgetown University', 'Clemson': 'Clemson University', 'Boston University': 'Boston University', 'Duke': 'Duke University', 'NYU': 'New York University',
  'Northwestern': 'Northwestern University', 'Univ of Vermont': 'University of Vermont', 'notre dame': 'University of Notre Dame', 'St Olaf': 'St Olaf College', 'Mt Holyoke': 'Mount Holyoke College', 'Penn State': 'Pennsylvania State University-Main Campus' };
const R = await page.evaluate(E => { const o = {}; for (const [q, want] of Object.entries(E)) { const h = searchCatalog(q) || []; o[q] = { top: h[0] && h[0].c.name, ok: !!(h[0] && h[0].c.name === want), top3: h.slice(0, 3).map(x => x.c.name) }; } 
  o._aliasesExist = Object.entries(SEARCH_ALIASES).filter(([k, v]) => !state.catalog.some(c => c.name === v)).map(([k]) => k); return o; }, EXPECT);
const ok = Object.fromEntries(Object.keys(EXPECT).map(q => [q, R[q].ok])); ok.allAliasTargetsInCatalog = !R._aliasesExist.length; ok.noErrors = !log.pageerr.length;
const out = { R, ok, allPass: Object.values(ok).every(Boolean) }; console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('./search-check-result-2026-10-11.json', import.meta.url), JSON.stringify(out, null, 1)); await b.close(); srv.close();
