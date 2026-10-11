// Zoe's Colleges service worker (#50). Makes the site installable and fast on repeat visits.
// - The page itself: network first (always the newest release), cached copy if offline.
// - Data files pinned to an exact release (cdn.jsdelivr.net/...@<commit>/...): cached forever — they never change.
// - Campus photos (thumb.wikimedia.org) and the sample video poster: cached, newest 300 kept.
// - NEVER cached: anything from Supabase (family data, sign-in) or our functions (Zoe, Pulse) — private or live.
const VERSION = "zc-v1";
const SHELL = "zc-shell-" + VERSION, DATA = "zc-data", IMG = "zc-img";
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("zc-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(name, max) { const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/supabase\.co$/.test(u.hostname) || u.pathname.startsWith("/.netlify/")) return;            // private / live: straight to network
  if (req.mode === "navigate" && u.origin === self.location.origin) {                                // the app page: newest first
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put("/", copy)); return r; }).catch(() => caches.match("/")));
    return;
  }
  if (u.hostname === "cdn.jsdelivr.net" && /zoescolleges-data@[0-9a-f]{7,40}\//.test(u.pathname)) {   // pinned data release: never changes
    e.respondWith(caches.open(DATA).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok) { c.put(req, r.clone()); trim(DATA, 8); } return r; }));
    return;
  }
  if (u.hostname === "thumb.wikimedia.org" || (u.origin === self.location.origin && /^\/(icons|media)\/.*\.(png|jpg)$/.test(u.pathname))) {
    e.respondWith(caches.open(IMG).then(async c => { const hit = await c.match(req); if (hit) return hit; try { const r = await fetch(req); if (r.ok || r.type === "opaque") { c.put(req, r.clone()); trim(IMG, 300); } return r; } catch (err) { return hit || Response.error(); } }));
  }
});
