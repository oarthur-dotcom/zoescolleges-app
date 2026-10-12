// Things to do near a campus, by category (#69, Oct 11). Free OpenStreetMap data via Overpass, asked by
// OUR server (not the browser) with two mirrors, short timeouts, and a 14-day cache — so a busy public
// server no longer means "Live place data is busy" for families. Signed-in members only; daily cap.
import { corsFor, requireUser, bumpDailyCap } from "../lib/guard.mjs";

const CATS = {
  food:     { r: 2500, q: 'nwr["amenity"~"^(restaurant|fast_food|food_court)$"]["name"]' },
  coffee:   { r: 2500, q: 'nwr["amenity"~"^(cafe|ice_cream)$"]["name"]' },
  stay:     { r: 6000, q: 'nwr["tourism"~"^(hotel|motel|guest_house|hostel)$"]["name"]' },
  see:      { r: 5000, q: 'nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium)$"]["name"]' },
  music:    { r: 5000, q: 'nwr["amenity"~"^(theatre|arts_centre|music_venue|nightclub|cinema)$"]["name"]' },
  outdoors: { r: 6000, q: 'nwr["leisure"~"^(park|nature_reserve|garden)$"]["name"]' },
};
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const DAILY_CAP = 3000, TTL = 14 * 864e5;
let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=3600", ...CORS } });
const miles = (a, b, c, d) => { const R = 3958.8, t = x => x * Math.PI / 180; const dl = t(c - a), dn = t(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

export function shape(elements, lat, lon) {
  const seen = new Set(), out = [];
  for (const e of elements || []) {
    const n = e.tags && e.tags.name; const la = e.lat ?? (e.center && e.center.lat), lo = e.lon ?? (e.center && e.center.lon);
    if (!n || la == null || lo == null) continue; const k = n.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    out.push({ name: String(n).slice(0, 80), lat: la, lon: lo, mi: Math.round(miles(lat, lon, la, lo) * 10) / 10,
      kind: (e.tags.cuisine || e.tags.amenity || e.tags.tourism || e.tags.leisure || "").split(";")[0].replace(/_/g, " ").slice(0, 30) });
  }
  return out.sort((a, b) => a.mi - b.mi).slice(0, 8);
}

async function cache() { try { const { getStore } = await import("@netlify/blobs"); return getStore({ name: "places-cache" }); } catch { return null; } }

export default async (req, ctx, deps = {}) => {
  const fetchImpl = deps.fetch || fetch;
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const user = deps.user || await requireUser(req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const u = new URL(req.url); const lat = +u.searchParams.get("lat"), lon = +u.searchParams.get("lon"), cat = u.searchParams.get("cat");
  if (!CATS[cat] || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180) || (!lat && !lon)) return json({ error: "bad request" }, 400);
  const key = `${cat}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const store = deps.store !== undefined ? deps.store : await cache();
  if (store) { try { const hit = await store.get(key, { type: "json" }); if (hit && Date.now() - hit.t < TTL) return json({ places: hit.p, cached: true }); } catch {} }
  const cap = deps.cap || await bumpDailyCap("places-usage", DAILY_CAP);
  if (cap.capped) return json({ busy: true });
  const { r, q } = CATS[cat];
  const query = `[out:json][timeout:8];(${q}(around:${r},${lat},${lon}););out center 60;`;
  for (const m of MIRRORS) {
    try {
      const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 9000);
      const res = await fetchImpl(m, { method: "POST", body: "data=" + encodeURIComponent(query), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ZoesColleges/1.0 (+https://zoescolleges.com)" }, signal: ac.signal });
      clearTimeout(tm); if (!res.ok) continue;
      const j = await res.json(); const places = shape(j.elements, lat, lon);
      if (store) { try { await store.setJSON(key, { t: Date.now(), p: places }); } catch {} }
      return json({ places });
    } catch { /* next mirror */ }
  }
  return json({ busy: true });
};
