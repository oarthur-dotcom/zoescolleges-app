// Campus Pulse v2 — server function tests (no network: fake fetch + in-memory cache).
// Run from the repo root: node tests/campus-pulse-v2-fn-test.mjs
import fs from 'fs';
const M = await import('../netlify/functions/campus-pulse.mjs');
const handler = M.default;
const NOW = Date.parse('2026-10-11T15:00:00Z');
const day = n => new Date(NOW - n * 864e5).toUTCString();
const rss = items => `<?xml version="1.0"?><rss><channel>${items.map(([t, l, d]) => `<item><title>${t}</title><link>${l}</link><pubDate>${d}</pubDate></item>`).join('')}</channel></rss>`;
const NEWS = rss([['Researchers discover new enzyme', 'https://www.x.edu/news/1', day(1)], ['Tigers win ACC championship', 'https://www.x.edu/news/2', day(3)],
  ['Homecoming weekend: what to know', 'https://www.x.edu/news/3', day(9)], ['Board approves budget', 'https://www.x.edu/news/4', day(45)]]);
const ADM = rss([['Early decision applications: 5 tips', 'https://admissions.x.edu/blog/a', day(2)], ['Meet our tour guides', 'https://admissions.x.edu/blog/b', day(20)]]);
const EVIL = `<rss><channel><item><title><![CDATA[<script>alert(1)</script>Big &#8217;win&#8217;]]></title><link>javascript:alert(1)</link><pubDate>${day(1)}</pubDate></item>
<item><title>Fun &lt;img src=x onerror=alert(1)&gt; night</title><link>https://evil.edu/a</link><pubDate>${day(2)}</pubDate></item></channel></rss>`;
const inst = (iso, allDay = false) => ({ event_instance: { start: iso, all_day: allDay } });
const LOCALIST = { events: [
  { event: { title: 'Fall Open House', localist_url: 'https://events.x.edu/event/open-house', location_name: 'Main Quad', event_instances: [inst('2026-10-17T10:00:00-04:00')] } },
  { event: { title: 'Already over', localist_url: 'https://events.x.edu/event/old', event_instances: [inst('2026-10-01T10:00:00-04:00')] } },
  { event: { title: 'Phishing event', localist_url: 'https://evil.com/event/x', event_instances: [inst('2026-10-13T10:00:00-04:00')] } },
  { event: { title: 'Jazz Night', localist_url: 'https://events.x.edu/event/jazz', location_name: 'Concert Hall', event_instances: [inst('2026-10-12T19:30:00-04:00')] } },
  { event: { title: 'Faculty Senate meeting', localist_url: 'https://events.x.edu/event/senate', event_instances: [inst('2026-10-12T15:00:00-04:00')] } },
  { event: { title: 'Jazz Night', localist_url: 'https://events.x.edu/event/jazz-2', event_instances: [inst('2026-10-19T19:30:00-04:00')] } },
] };
const FEEDS = { schools: {
  'sc-x': { news: 'https://www.x.edu/news/feed', admissions: 'https://admissions.x.edu/feed', events: { type: 'localist', url: 'https://events.x.edu/api/2/events' }, studentSite: 'https://www.xdaily.com' },
  'sc-v1': { news: 'https://www.v1.edu/feed' },
  'sc-evil': { news: 'https://evil.edu/feed' },
  'sc-slow': { news: 'https://slow.edu/feed' },
  'sc-bad': { news: 'javascript:alert(1)' },
} };
let fetched = [];
const fakeFetch = async (url) => { url = String(url); fetched.push(url);
  if (url.includes('campus-feeds.json')) return new Response(JSON.stringify(FEEDS));
  if (url.startsWith('https://www.x.edu/news/feed')) return new Response(NEWS);
  if (url.startsWith('https://admissions.x.edu/feed')) return new Response(ADM);
  if (url.startsWith('https://events.x.edu/api/2/events?')) return new Response(JSON.stringify(LOCALIST));
  if (url.startsWith('https://www.v1.edu/feed')) return new Response(NEWS);
  if (url.startsWith('https://evil.edu/feed')) return new Response(EVIL);
  if (url.startsWith('https://slow.edu/feed')) { await new Promise(r => setTimeout(r, 400)); return new Response(NEWS); }
  return new Response('no', { status: 404 }); };
const mem = new Map(); const blobs = { get: async k => mem.get(k) || null, setJSON: async (k, v) => mem.set(k, v) };
const R = {}; const ok = {};

const p = await M.pulseFor('sc-x', { fetchImpl: fakeFetch, blobs, now: NOW });
R.sections = Object.fromEntries(Object.entries(p.sections).map(([k, v]) => [k, v.map(i => `${i.title} | ${i.topic || i.where || ''}`)]));
R.meter = p.meter; R.studentSite = p.studentSite;
ok.allFourKindsWork = !!(p.sections.news && p.sections.admissions && p.sections.events) && p.studentSite === 'https://www.xdaily.com';
ok.topicsTagged = p.sections.news[0].topic === 'Research' && p.sections.news[1].topic === 'Sports' && p.sections.news[2].topic === 'Campus life' && p.sections.admissions[0].topic === 'Admissions & aid';
ok.meterCountsLast30Days = p.meter.recent30 === 5 && p.meter.level === 'active' && p.meter.events === 2;
ok.eventsUpcomingOnlySortedNoDupes = JSON.stringify(p.sections.events.map(e => e.title)) === '["Jazz Night","Fall Open House"]';
ok.eventLinksStayOnSchoolDomain = !p.sections.events.some(e => /evil\.com/.test(e.link));
ok.staffOnlyEventsHidden = !p.sections.events.some(e => /Senate/.test(e.title));
ok.eventPlaceKept = p.sections.events[1].where === 'Main Quad';
ok.v1ShapeKept = Array.isArray(p.items) && p.items.length === 4 && p.source === 'x.edu';
fetched = [];
const p2 = await M.pulseFor('sc-x', { fetchImpl: fakeFetch, blobs, now: NOW + 60e3 });
ok.secondCallServedFromCache = !fetched.some(u => /x\.edu|xdaily/.test(u)) && p2.sections.news.length === 4;
fetched = [];
await M.pulseFor('sc-x', { fetchImpl: fakeFetch, blobs, now: NOW + 4 * 3600e3 });
ok.cacheExpiresAfter3h = fetched.some(u => u.startsWith('https://www.x.edu/news/feed'));
const pv1 = await M.pulseFor('sc-v1', { fetchImpl: fakeFetch, blobs, now: NOW });
ok.oldV1EntryStillWorks = pv1.sections.news.length === 4 && !pv1.sections.events;
const pe = await M.pulseFor('sc-evil', { fetchImpl: fakeFetch, blobs, now: NOW });
R.hostile = pe.sections.news;
ok.hostileFeedStripped = pe.sections.news.length === 1 && !/[<>]/.test(pe.sections.news[0].title) && pe.sections.news[0].link === 'https://evil.edu/a';
const pb = await M.pulseFor('sc-bad', { fetchImpl: fakeFetch, blobs, now: NOW });
ok.nonWebFeedUrlNeverFetched = pb.reason === 'no-feed' && !fetched.some(u => u.startsWith('javascript'));
const pu = await M.pulseFor('sc-unknown', { fetchImpl: fakeFetch, blobs, now: NOW });
ok.unknownSchoolNothingFetched = pu.reason === 'no-feed';

// digest
mem.clear(); fetched = [];
const d = await M.digestFor(['sc-x', 'sc-v1', 'sc-unknown'], { fetchImpl: fakeFetch, blobs, now: NOW });
R.digest = Object.fromEntries(Object.entries(d.schools).map(([k, v]) => [k, v.top.map(t => `${t.kind}: ${t.title}`)]));
ok.digestTop3PerSchoolNewestFirst = d.schools['sc-x'].top.length === 3 && d.schools['sc-x'].top[0].title === 'Researchers discover new enzyme' && d.schools['sc-x'].top[1].kind === 'admissions';
ok.digestSkipsEvents = !fetched.some(u => u.includes('/api/2/events'));
ok.digestReportsUnknown = JSON.stringify(d.none) === '["sc-unknown"]';
mem.clear();
const d2 = await M.digestFor(['sc-slow', 'sc-slow', 'sc-slow', 'sc-slow', 'sc-slow', 'sc-slow', 'sc-x', 'sc-v1'], { fetchImpl: fakeFetch, blobs, now: NOW, budgetMs: 50 });
ok.timeBudgetLeavesRestPending = JSON.stringify(d2.pending.sort()) === '["sc-v1","sc-x"]';

// handler: login + id checks
const call = async (url, auth) => { const r = await handler(new Request(url, { headers: { origin: 'https://zoescolleges.com', ...(auth ? { authorization: auth } : {}) } })); return r.status; };
ok.noLoginRefused = (await call('https://zoescolleges.com/.netlify/functions/campus-pulse?id=sc-x')) === 401;
ok.noLoginRefusedDigest = (await call('https://zoescolleges.com/.netlify/functions/campus-pulse?ids=sc-x,sc-v1')) === 401;
ok.postRefused = (await handler(new Request('https://zoescolleges.com/.netlify/functions/campus-pulse?id=sc-x', { method: 'POST' }))).status === 405;

R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./campus-pulse-v2-fn-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
