// Campus Pulse (Oct 11): the newest headlines from a school's OWN news feed (RSS/Atom).
// Safety:
//  - Only fetches feed URLs from the reviewed list campus-feeds.json (published via the approved @live
//    catalog branch). The browser sends a school id, never a URL, so this can't be used to fetch other sites.
//  - Signed-in users only; zoescolleges.com origins only (shared guard).
//  - Headlines + links + dates only (what feeds are published for); everything is stripped to plain text.
//  - Cached per school for 3 hours in Netlify Blobs so schools' sites aren't hit on every page view.
import { corsFor, requireUser } from "../lib/guard.mjs";

const FEEDS_URL = "https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@live/campus-feeds.json";
const TTL_MS = 3 * 60 * 60 * 1000;
const MAX_ITEMS = 5;
let feedsCache = { at: 0, map: null };
let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
export function plain(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ").trim();
}
export function parseFeed(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const x = m[0];
    const title = plain((x.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    let link = (x.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    if (!link || /<link[^>]*\/>/.test(link)) link = (x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) || [])[1];
    link = plain(link);
    const dRaw = plain((x.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2]);
    const t = Date.parse(dRaw);
    if (!title || !/^https?:\/\//i.test(link)) continue;
    out.push({ title: title.slice(0, 160), link, date: isNaN(t) ? null : new Date(t).toISOString() });
  }
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, MAX_ITEMS);
}

async function feedsMap(fetchImpl) {
  if (feedsCache.map && Date.now() - feedsCache.at < 60 * 60 * 1000) return feedsCache.map;
  const r = await fetchImpl(FEEDS_URL); if (!r.ok) throw new Error("feeds list " + r.status);
  const j = await r.json(); feedsCache = { at: Date.now(), map: j.schools || {} }; return feedsCache.map;
}
async function store() { try { const { getStore } = await import("@netlify/blobs"); return getStore({ name: "campus-pulse", consistency: "eventual" }); } catch (e) { return null; } }

export async function pulseFor(id, { fetchImpl = fetch, blobs = undefined, now = Date.now() } = {}) {
  const map = await feedsMap(fetchImpl);
  const entry = map[id]; if (!entry || !entry.news) return { items: [], reason: "no-feed" };
  const st = blobs === undefined ? await store() : blobs;
  if (st) { try { const c = await st.get(id, { type: "json" }); if (c && now - c.at < TTL_MS) return { ...c.data, cached: true }; } catch (e) {} }
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
  let items = [];
  try {
    const r = await fetchImpl(entry.news, { headers: { "User-Agent": "ZoesCollegesCampusPulse/1.0 (+https://zoescolleges.com)" }, signal: ctrl.signal });
    if (r.ok) { const text = (await r.text()).slice(0, 600000); items = parseFeed(text); }
  } catch (e) { console.error("[campus-pulse]", id, e && e.message); }
  finally { clearTimeout(to); }
  let source = ""; try { source = new URL(entry.news).hostname.replace(/^www\./, ""); } catch (e) {}
  const data = { items, source, reason: items.length ? null : "feed-unavailable" };
  if (st && items.length) { try { await st.setJSON(id, { at: now, data }); } catch (e) {} }
  return data;
}

export default async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "method" }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: "signin" }, 401);
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-z0-9-]{2,80}$/i.test(id)) return json({ error: "bad id" }, 400);
  try { return json(await pulseFor(id)); }
  catch (e) { console.error("[campus-pulse]", e && e.message); return json({ items: [], reason: "error" }); }
};
