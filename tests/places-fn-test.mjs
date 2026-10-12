// #69 places-near: categories, distance sort, cache, mirror fallback, honest "busy". No network.
const fn = (await import(new URL('../netlify/functions/places-near.mjs', import.meta.url))).default;
let calls = [], mode = 'ok';
const ELS = [{ type: 'node', lat: 42.36, lon: -71.09, tags: { name: 'Far Cafe', amenity: 'cafe' } }, { type: 'way', center: { lat: 42.3601, lon: -71.0942 }, tags: { name: 'Near Diner', amenity: 'restaurant', cuisine: 'american;burger' } }, { type: 'node', lat: 42.3601, lon: -71.0942, tags: { name: 'near diner', amenity: 'restaurant' } }, { type: 'node', lat: 42.37, lon: -71.1, tags: { amenity: 'restaurant' } }];
const f = async (url, opts) => { calls.push(String(url)); if (mode === 'down') throw new Error('x'); if (mode === 'firstdown' && calls.length === 1) return new Response('busy', { status: 504 }); return new Response(JSON.stringify({ elements: ELS }), { status: 200 }); };
const mem = { d: {}, async get(k) { return this.d[k] || null; }, async setJSON(k, v) { this.d[k] = v; } };
const call = async (qs, over = {}) => { calls = []; const r = await fn(new Request('https://zoescolleges.com/.netlify/functions/places-near?' + qs, { headers: { origin: 'https://zoescolleges.com' } }), {}, { fetch: f, user: over.nouser ? null : { id: 'u' }, store: over.store === undefined ? mem : over.store, cap: over.cap || { capped: false } }); return { status: r.status, j: await r.json() }; };
const ok = {}, R = {};
let r = await call('cat=food&lat=42.3601&lon=-71.0942', { nouser: true }); ok.signedInOnly = r.status === 401;
r = await call('cat=hacking&lat=42.36&lon=-71.09'); ok.knownCategoriesOnly = r.status === 400;
r = await call('cat=food&lat=42.3601&lon=-71.0942'); R.first = r.j;
ok.sortedDedupedNamed = r.j.places.length === 2 && r.j.places[0].name === 'Near Diner' && r.j.places[0].mi === 0 && r.j.places[0].kind === 'american' && calls.length === 1;
r = await call('cat=food&lat=42.3601&lon=-71.0942'); ok.cached = r.j.cached === true && calls.length === 0;
mode = 'firstdown'; r = await call('cat=coffee&lat=40&lon=-75', { store: null }); ok.secondMirror = r.j.places && calls.length === 2;
mode = 'down'; r = await call('cat=stay&lat=41&lon=-75', { store: null }); ok.honestBusy = r.j.busy === true;
mode = 'ok'; r = await call('cat=see&lat=41&lon=-76', { store: null, cap: { capped: true } }); ok.dailyCap = r.j.busy === true && calls.length === 0;
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
