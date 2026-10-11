// #34 weekly Pulse email job + events digest — no network (fake Supabase/Resend/feeds). Run: node tests/pulse-weekly-job-test.mjs
import fs from 'fs';
const W = await import('../netlify/functions/pulse-weekly.mjs');
const P = await import('../netlify/functions/campus-pulse.mjs');
const NOW = new Date('2026-10-12T12:00:00Z');   // a Monday, 8 AM Eastern
const ago = d => new Date(NOW - d * 864e5).toISOString(), ahead = d => new Date(+NOW + d * 864e5).toISOString();
const R = {}, ok = {};
ok.weekIsMonday = W.weekOf(NOW) === '2026-10-12' && W.weekOf(new Date('2026-10-18T15:00:00Z')) === '2026-10-12';
ok.visitWords = ['Fall Open House', 'Campus tour and information session', 'Admitted Students Day', 'Preview Day: Engineering', 'Discover Wake Day'].every(P.isVisitEvent)
  && !['Jazz Night', 'Faculty Senate', 'Homecoming parade', 'Basketball vs. Duke'].some(P.isVisitEvent);
// digest with events: visits picked out of the calendar
const FEEDS = { schools: { 'sc-x': { news: 'https://www.x.edu/feed', events: { type: 'localist', url: 'https://events.x.edu/api/2/events' } } } };
const rss = `<rss><channel><item><title>Big research news</title><link>https://www.x.edu/n1</link><pubDate>${new Date(+NOW - 864e5).toUTCString()}</pubDate></item></channel></rss>`;
const inst = iso => ({ event_instance: { start: iso, all_day: false } });
const LOC = { events: [{ event: { title: 'Jazz Night', localist_url: 'https://events.x.edu/e/1', event_instances: [inst(ahead(2))] } },
  { event: { title: 'Fall Open House', localist_url: 'https://events.x.edu/e/2', location_name: 'Quad', event_instances: [inst(ahead(5))] } }] };
const ff = async u => { u = String(u); if (u.includes('campus-feeds')) return new Response(JSON.stringify(FEEDS)); if (u.startsWith('https://www.x.edu/feed')) return new Response(rss);
  if (u.startsWith('https://events.x.edu')) return new Response(JSON.stringify(LOC)); return new Response('', { status: 404 }); };
P._resetFeedsCache();
const mem = new Map(); const blobs = { get: async k => mem.get(k) || null, setJSON: async (k, v) => mem.set(k, v) };
const dg = await P.digestFor(['sc-x'], { fetchImpl: ff, blobs, now: +NOW, withEvents: true });
R.digest = dg.schools['sc-x'];
ok.digestHasVisitsOnly = dg.schools['sc-x'].visits.length === 1 && dg.schools['sc-x'].visits[0].title === 'Fall Open House' && dg.schools['sc-x'].stories.length === 1;
P._resetFeedsCache();
const dg0 = await P.digestFor(['sc-x'], { fetchImpl: ff, blobs: { get: async () => null, setJSON: async () => {} }, now: +NOW });
ok.plainDigestUnchanged = !('visits' in dg0.schools['sc-x']) && dg0.schools['sc-x'].top.length === 1;
// email body
const mail = W.buildWeekly({ schools: { 'sc-x': { stories: [{ title: 'Big <b>research</b> news', link: 'javascript:alert(1)', date: ago(1), kind: 'news' }, { title: 'Old story', link: 'https://x.edu/o', date: ago(20), kind: 'news' }],
  visits: [{ title: 'Fall Open House', link: 'https://events.x.edu/e/2', date: ahead(5) }] } }, names: { 'sc-x': 'X University' }, now: +NOW });
R.subject = mail.subject;
ok.emailOnlyThisWeek = mail.stories === 1 && mail.visits === 1 && !/Old story/.test(mail.html);
ok.emailEscapesAndBlocksBadLinks = !/<b>research/.test(mail.html) && !/javascript:/.test(mail.html);
ok.nothingNewNoEmail = W.buildWeekly({ schools: { 'sc-x': { stories: [{ title: 'Old', link: 'https://x', date: ago(30) }], visits: [] } }, names: {}, now: +NOW }) === null;
// job: fake Supabase + Resend
function fakeEnv(opts = {}) {
  const calls = []; const logRows = opts.alreadySent ? [{ user_id: 'u1' }] : [];
  const fetchImpl = async (url, o = {}) => { url = String(url); calls.push((o.method || 'GET') + ' ' + url);
    if (url.includes('reminder_prefs')) return opts.noColumn ? new Response('column does not exist', { status: 400 }) : new Response(JSON.stringify([{ user_id: 'u1', family_id: 'f1' }, { user_id: 'u2', family_id: 'f1' }]));
    if (url.includes('family_schools')) return new Response(JSON.stringify([{ family_id: 'f1', school_id: 'sc-x', name: 'X University' }]));
    if (url.includes('pulse_weekly_log') && (o.method || 'GET') === 'GET') return new Response(JSON.stringify(logRows));
    if (url.includes('pulse_weekly_log') && o.method === 'POST') return new Response(JSON.stringify([{ id: 1 }]));
    if (url.includes('/auth/v1/admin/users/')) return new Response(JSON.stringify({ email: url.endsWith('u1') ? 'a@example.com' : 'b@example.com' }));
    if (url.includes('api.resend.com')) return new Response('{}');
    return new Response('nope', { status: 404 }); };
  return { fetchImpl, calls };
}
const digest = async () => ({ schools: { 'sc-x': { stories: [{ title: 'Big research news', link: 'https://www.x.edu/n1', date: ago(1), kind: 'news' }], visits: [] } } });
const quiet = { log() {}, error() {} };
let f = fakeEnv(); const dry = await W.runWeekly({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: f.fetchImpl, now: NOW, log: quiet, digest });
ok.dryRunSendsNothing = dry.emails === 2 && !dry.live && !f.calls.some(c => /resend|POST/.test(c));
f = fakeEnv(); const live = await W.runWeekly({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k', PULSE_WEEKLY_LIVE: 'yes', RESEND_API_KEY: 'r' }, fetchImpl: f.fetchImpl, now: NOW, log: quiet, digest });
ok.liveSendsOnePerPerson = live.emails === 2 && f.calls.filter(c => /resend/.test(c)).length === 2 && f.calls.filter(c => /POST .*pulse_weekly_log/.test(c)).length === 2;
f = fakeEnv({ alreadySent: true }); const again = await W.runWeekly({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k', PULSE_WEEKLY_LIVE: 'yes', RESEND_API_KEY: 'r' }, fetchImpl: f.fetchImpl, now: NOW, log: quiet, digest });
ok.neverTwiceSameWeek = again.emails === 1 && again.skipped.some(s => /already sent/.test(s));
f = fakeEnv({ noColumn: true }); const pre = await W.runWeekly({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k', PULSE_WEEKLY_LIVE: 'yes', RESEND_API_KEY: 'r' }, fetchImpl: f.fetchImpl, now: NOW, log: quiet, digest });
ok.beforeMigrationDoesNothing = pre.emails === 0 && /migration 011/.test(pre.errors[0]) && !f.calls.some(c => /resend/.test(c));
const nokey = await W.runWeekly({ env: {}, fetchImpl: f.fetchImpl, now: NOW, log: quiet, digest });
ok.noKeyNoSend = nokey.emails === 0 && /SERVICE_ROLE/.test(nokey.errors[0]);
ok.scheduledMondays = W.config.schedule === '0 12 * * 1';
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./pulse-weekly-job-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
