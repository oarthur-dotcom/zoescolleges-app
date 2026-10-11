// Campus Pulse v2 (Oct 11): what's happening at a school right now, from the school's OWN public feeds.
//   news        official news feed (RSS/Atom)
//   admissions  the admissions office's blog/news feed
//   student     the student newspaper's feed (added as Muse verifies them)
//   events      the school's public campus calendar (Localist JSON API)
// Safety:
//  - Only fetches URLs from the reviewed list campus-feeds.json (published via the approved @live catalog
//    branch). The browser sends school ids, never URLs, so this can't be used to fetch other sites.
//  - Signed-in users only; zoescolleges.com origins only (shared guard).
//  - Headlines, links, dates (and event place names) only — what feeds are published for. Everything is
//    reduced to plain text; non-web links are dropped; event links must stay on the school's domain.
//  - Each source is cached for 3 hours in Netlify Blobs so schools' sites aren't hit on every page view.
import { createHash } from "node:crypto";
import { corsFor, requireUser } from "../lib/guard.mjs";

const FEEDS_URL = "https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@live/campus-feeds.json";
const TTL_MS = 3 * 60 * 60 * 1000;
const STORY_KINDS = ["news", "admissions", "student"];
const MAX = { news: 6, admissions: 4, student: 5, events: 6 };
const UA = "ZoesCollegesCampusPulse/2.0 (+https://zoescolleges.com)";
let feedsCache = { at: 0, map: null };
let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
export function plain(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return " "; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch (e) { return " "; } })
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, " ")            // a second pass catches tags that were entity-encoded
    .replace(/\s+/g, " ").trim();
}

// What a headline is about, so families can scan. First match wins; order matters.
const TOPICS = [
  ["Admissions & aid", /\b(admissions?|admitted|apply|applicants?|applications?|scholarships?|financial aid|tuition|fafsa|enroll\w*|class of 20\d\d|early (decision|action)|open house|info(rmation)? sessions?|campus tours?)\b/i],
  ["Sports", /\b(games?|tournaments?|championships?|coach\w*|athlet\w*|football|basketball|soccer|volleyball|hockey|lacrosse|baseball|softball|tennis|swim\w*|wrestling|rowing|golf|track and field|cross country|ncaa|playoffs?|varsity|tailgat\w*)\b/i],
  ["Research", /\b(research\w*|study (finds|shows)|scientists?|grants?|discover\w*|laborator\w*|labs?|nih|nsf|clinical trials?)\b/i],
  ["Arts", /\b(arts?|music\w*|concerts?|theat(er|re)s?|exhibit\w*|films?|galler(y|ies)|dance\w*|poet\w*|museums?|orchestra|choir|opera|recitals?)\b/i],
  ["Careers", /\b(careers?|internships?|jobs?|employers?|alumn\w*)\b/i],
  ["Health", /\b(health\w*|wellness|mental|medical|medicine|nursing|hospitals?|clinics?|vaccines?)\b/i],
  ["Campus life", /\b(students?|homecoming|festivals?|clubs?|housing|dining|residence|orientation|celebrat\w*|move-in|commencement|graduation|family weekend)\b/i],
];
export function topicOf(title) { for (const [t, re] of TOPICS) if (re.test(title)) return t; return "News"; }

const okLink = u => /^https?:\/\//i.test(u || "");
const regdom = h => String(h || "").toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");

export function parseFeed(xml, max = 6) {
  const out = [];
  for (const m of String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const x = m[0];
    const title = plain((x.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    let link = (x.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    if (!link || /<link[^>]*\/>/.test(link)) link = (x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) || [])[1];
    link = plain(link);
    const dRaw = plain((x.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2]);
    const t = Date.parse(dRaw);
    if (!title || !okLink(link)) continue;
    out.push({ title: title.slice(0, 160), link, date: isNaN(t) ? null : new Date(t).toISOString() });
  }
  out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { items: out.slice(0, max), all: out };
}

// Calendar items that are for employees or internal logistics, not for families.
const NOT_FOR_FAMILIES = /\b(faculty|staff|employees?|class project|office hours|raffle|committee|meeting|training|webinar for (faculty|staff)|payroll|benefits enrollment|senate)\b/i;
export function parseLocalist(j, base, now = Date.now(), max = 6) {
  const dom = (() => { try { return regdom(new URL(base).hostname); } catch (e) { return ""; } })();
  const out = []; const seen = new Set();
  for (const w of (j && j.events) || []) {
    const e = (w && w.event) || {};
    const title = plain(e.title).slice(0, 160);
    let link = String(e.localist_url || "");
    try { if (!okLink(link) || regdom(new URL(link).hostname) !== dom) continue; } catch (err) { continue; }
    if (!title || seen.has(title) || NOT_FOR_FAMILIES.test(title)) continue;
    const starts = ((e.event_instances || []).map(i => Date.parse(((i || {}).event_instance || {}).start)).filter(t => !isNaN(t) && t >= now - 6 * 3600e3)).sort((a, b) => a - b);
    if (!starts.length) continue;
    seen.add(title);
    const allDay = !!(((e.event_instances || [])[0] || {}).event_instance || {}).all_day;
    out.push({ title, link, date: new Date(starts[0]).toISOString(), where: plain(e.location_name).slice(0, 80) || null, allDay });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(0, max);
}

async function feedsMap(fetchImpl) {
  if (feedsCache.map && Date.now() - feedsCache.at < 60 * 60 * 1000) return feedsCache.map;
  const r = await fetchImpl(FEEDS_URL); if (!r.ok) throw new Error("feeds list " + r.status);
  const j = await r.json(); feedsCache = { at: Date.now(), map: j.schools || {} }; return feedsCache.map;
}
export function _resetFeedsCache() { feedsCache = { at: 0, map: null }; }
async function store() { try { const { getStore } = await import("@netlify/blobs"); return getStore({ name: "campus-pulse", consistency: "eventual" }); } catch (e) { return null; } }

// Normalise a school's entry: v1 had only {news: url}. Events are {type:"localist", url}.
function sourcesOf(entry) {
  const s = {};
  for (const k of STORY_KINDS) if (typeof entry[k] === "string" && okLink(entry[k])) s[k] = entry[k];
  const ev = entry.events;
  if (ev && typeof ev === "object" && ev.type === "localist" && okLink(ev.url)) s.events = ev.url;
  return s;
}

async function fetchSource(kind, url, { fetchImpl, now }) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    if (kind === "events") {
      const r = await fetchImpl(`${url}?days=21&pp=40`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
      if (!r.ok) return null;
      const j = JSON.parse((await r.text()).slice(0, 900000));
      return { items: parseLocalist(j, url, now, MAX.events) };
    }
    const r = await fetchImpl(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!r.ok) return null;
    const p = parseFeed((await r.text()).slice(0, 900000), MAX[kind]);
    const recent = p.all.filter(i => i.date && now - Date.parse(i.date) <= 30 * 86400e3).length;
    return { items: p.items.map(i => ({ ...i, topic: topicOf(i.title) })), recent30: recent };
  } catch (e) { console.error("[campus-pulse]", kind, url, e && e.message); return null; }
  finally { clearTimeout(to); }
}

const key = (id, kind, url) => `v2:${id}:${kind}:${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;

async function cachedSource(st, id, kind, url, opts) {
  const k = key(id, kind, url);
  if (st) { try { const c = await st.get(k, { type: "json" }); if (c && opts.now - c.at < TTL_MS) return { ...c.data, cached: true }; } catch (e) {} }
  const data = await fetchSource(kind, url, opts);
  if (data && st && (data.items || []).length) { try { await st.setJSON(k, { at: opts.now, data }); } catch (e) {} }
  return data;
}

export function meterOf(sections) {
  const stories = STORY_KINDS.flatMap(k => sections[k] || []);
  const recent30 = STORY_KINDS.reduce((n, k) => n + ((sections["_" + k] || {}).recent30 || 0), 0);
  const newest = stories.map(i => i.date).filter(Boolean).sort().pop() || null;
  const level = recent30 >= 12 ? "very-active" : recent30 >= 5 ? "active" : recent30 >= 1 ? "steady" : "quiet";
  return { recent30, newest, events: (sections.events || []).length, level };
}

export async function pulseFor(id, { fetchImpl = fetch, blobs = undefined, now = Date.now(), kinds = null } = {}) {
  const map = await feedsMap(fetchImpl);
  const entry = map[id];
  const src = entry ? sourcesOf(entry) : {};
  const want = Object.keys(src).filter(k => !kinds || kinds.includes(k));
  if (!want.length) return { id, items: [], sections: {}, meter: null, sources: {}, reason: "no-feed" };
  const st = blobs === undefined ? await store() : blobs;
  const got = await Promise.all(want.map(k => cachedSource(st, id, k, src[k], { fetchImpl, now })));
  const sections = {}; const sources = {};
  want.forEach((k, i) => {
    const g = got[i];
    if (g && g.items && g.items.length) { sections[k] = g.items; sections["_" + k] = { recent30: g.recent30 || 0 }; }
    try { sources[k] = new URL(src[k]).hostname.replace(/^www\./, ""); } catch (e) {}
  });
  const meter = meterOf(sections);
  for (const k of Object.keys(sections)) if (k.startsWith("_")) delete sections[k];
  const items = sections.news || [];      // v1 shape, kept so an old open page still works
  const any = Object.values(sections).some(a => a.length);
  return { id, items, source: sources.news || "", sections, meter, sources,
           studentSite: entry && typeof entry.studentSite === "string" && okLink(entry.studentSite) ? entry.studentSite : null,
           reason: any ? null : "feed-unavailable" };
}

// Board digest: newest stories across several schools, within a time budget. Anything not ready is
// reported as pending so the page can ask again a moment later (by then it's cached).
export async function digestFor(ids, { fetchImpl = fetch, blobs = undefined, now = Date.now(), budgetMs = 7000 } = {}) {
  const map = await feedsMap(fetchImpl);
  const st = blobs === undefined ? await store() : blobs;
  const out = {}; const pending = []; const queue = ids.filter(id => map[id]);
  const none = ids.filter(id => !map[id]);
  const started = Date.now(); let i = 0;
  async function worker() {
    while (i < queue.length) {
      const id = queue[i++];
      if (Date.now() - started > budgetMs) { pending.push(id); continue; }
      try {
        const p = await pulseFor(id, { fetchImpl, blobs: st, now, kinds: STORY_KINDS });
        const top = STORY_KINDS.flatMap(k => (p.sections[k] || []).map(x => ({ ...x, kind: k }))).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 3);
        out[id] = { top, meter: p.meter };
      } catch (e) { pending.push(id); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return { schools: out, pending, none };
}

export default async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "method" }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: "signin" }, 401);
  const u = new URL(req.url);
  const idOk = s => /^[a-z0-9-]{2,80}$/i.test(s);
  if (u.searchParams.has("ids")) {
    const ids = [...new Set(u.searchParams.get("ids").split(",").map(s => s.trim()).filter(Boolean))];
    if (!ids.length || ids.length > 30 || !ids.every(idOk)) return json({ error: "bad ids" }, 400);
    try { return json(await digestFor(ids)); }
    catch (e) { console.error("[campus-pulse] digest", e && e.message); return json({ schools: {}, pending: ids, none: [] }); }
  }
  const id = u.searchParams.get("id") || "";
  if (!idOk(id)) return json({ error: "bad id" }, 400);
  try { return json(await pulseFor(id)); }
  catch (e) { console.error("[campus-pulse]", e && e.message); return json({ items: [], sections: {}, reason: "error" }); }
};
