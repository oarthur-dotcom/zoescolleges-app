import fs from 'fs';
const { pulseFor, parseFeed, plain } = await import('./netlify/functions/campus-pulse.mjs');
const handler = (await import('./netlify/functions/campus-pulse.mjs')).default;
const UCF = fs.readFileSync('ucf.xml','utf8');
const EVIL = `<rss><channel><item><title><![CDATA[<script>alert(1)</script>Big &#8217;game&#8217; win]]></title><link>javascript:alert(1)</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Homecoming &amp; more <img src=x onerror=alert(1)></title><link>https://example.edu/a</link><pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
const FEEDS = { schools: { "sc-ucf": { news: "https://www.ucf.edu/news/feed/" }, "sc-evil": { news: "https://example.edu/feed" } } };
let fetched = [];
const fakeFetch = async (url) => { url=String(url); fetched.push(url);
  if (url.includes('campus-feeds.json')) return new Response(JSON.stringify(FEEDS));
  if (url.includes('ucf.edu')) return new Response(UCF);
  if (url.includes('example.edu')) return new Response(EVIL);
  return new Response('no', { status: 404 }); };
const mem = new Map(); const blobs = { get: async k => mem.get(k) || null, setJSON: async (k, v) => mem.set(k, v) };
const out = {};
const r1 = await pulseFor('sc-ucf', { fetchImpl: fakeFetch, blobs });
out.realUCF = { count: r1.items.length, source: r1.source, first: r1.items[0] };
fetched = []; const r2 = await pulseFor('sc-ucf', { fetchImpl: fakeFetch, blobs });
out.secondCallServedFromCache = r2.cached === true && !fetched.some(u => u.includes('ucf.edu'));
out.cacheExpiresAfter3h = (await pulseFor('sc-ucf', { fetchImpl: fakeFetch, blobs, now: Date.now() + 4*3600e3 })).cached !== true;
const r3 = await pulseFor('sc-evil', { fetchImpl: fakeFetch, blobs });
out.hostileFeed = r3.items;
out.notInReviewedList = await pulseFor('sc-unknown', { fetchImpl: fakeFetch, blobs });
// handler: login + id checks (no network for these)
const call = async (url, auth) => { const r = await handler(new Request(url, { headers: { origin: 'https://zoescolleges.com', ...(auth ? { authorization: auth } : {}) } })); return [r.status, await r.json()]; };
out.noLogin = await call('https://zoescolleges.com/.netlify/functions/campus-pulse?id=sc-ucf');
console.log(JSON.stringify(out, null, 1));
