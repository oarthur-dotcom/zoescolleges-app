// Weekly Campus Pulse email (Oct 11, #34). Runs on Netlify's schedule (see `config`); not callable from a browser.
// For each person who switched the weekly Pulse email ON: read their family's board, gather the past week's
// stories and upcoming visit days from the schools' own feeds (same reviewed list and cache as the page),
// and send ONE short email. pulse_weekly_log makes sure nobody gets the same week twice.
//
// Needs Netlify env vars: SUPABASE_SERVICE_ROLE_KEY (server-only), RESEND_API_KEY.
// SAFETY: sends nothing unless PULSE_WEEKLY_LIVE = "yes". Otherwise it logs what it WOULD send (dry run).
// Needs migration 011 (adds reminder_prefs.pulse_weekly and pulse_weekly_log). Before that, it does nothing.
import { digestFor } from "./campus-pulse.mjs";
import { todayET } from "./deadline-reminders.mjs";

const SB_URL = "https://heppyuzvztjzhgfitrsb.supabase.co";
const FROM = "Zoe's Colleges <hello@zoescolleges.com>";
const SITE = "https://zoescolleges.com";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : SITE;
const day = iso => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });

// Monday of this week (America/New_York) — the key that stops a second send in the same week.
export function weekOf(now = new Date()) {
  const t = todayET(now); const d = new Date(t + "T12:00:00Z"); const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10);
}

export function buildWeekly({ schools, names, now = Date.now() }) {
  const week = 7 * 86400e3;
  const stories = Object.entries(schools).flatMap(([id, v]) => (v.stories || v.top || []).filter(x => x.date && now - Date.parse(x.date) <= week).slice(0, 2).map(x => ({ ...x, school: id })))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const visits = Object.entries(schools).flatMap(([id, v]) => (v.visits || []).map(x => ({ ...x, school: id }))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  if (!stories.length && !visits.length) return null;
  const nm = id => names[id] || id;
  const subject = stories.length ? `This week at your schools: ${nm(stories[0].school)} and ${stories.length > 1 ? `${stories.length - 1} more` : "more"}` : `Visit days coming up at your schools`;
  const row = (x, right) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e7e4dd"><span style="color:#0f7f80;font-size:12px;font-weight:700">${esc(nm(x.school))}</span><br><a href="${esc(safeUrl(x.link))}" style="color:#101c2e;font-weight:600;text-decoration:none">${esc(x.title)}</a></td><td style="padding:8px 10px;border-bottom:1px solid #e7e4dd;white-space:nowrap;color:#5f6982;font-size:12px">${esc(right)}</td></tr>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#101c2e">
  <h2 style="margin:0 0 6px">📰 This week at your schools</h2>
  <p style="margin:0 0 14px;color:#5f6982">From the schools' own news and calendars, for the colleges on your family's board.</p>
  ${stories.length ? `<table style="border-collapse:collapse;width:100%">${stories.map(x => row(x, day(x.date))).join("")}</table>` : ""}
  ${visits.length ? `<h3 style="margin:18px 0 6px;font-size:15px">🎟 Visit days &amp; open houses</h3><table style="border-collapse:collapse;width:100%">${visits.map(x => row(x, day(x.date))).join("")}</table>` : ""}
  <p style="margin:16px 0 0"><a href="${SITE}" style="color:#0f7f80;font-weight:700">Open Campus Pulse →</a></p>
  <p style="margin:18px 0 0;font-size:12px;color:#5f6982">Headlines link to each school's own site. You're getting this because you turned on the weekly Pulse email. Turn it off anytime in <b>Pulse → Weekly email</b>.</p></div>`;
  const text = [...stories.map(x => `${nm(x.school)}: ${x.title} (${day(x.date)}) ${safeUrl(x.link)}`), ...(visits.length ? ["", "Visit days & open houses:", ...visits.map(x => `${nm(x.school)}: ${x.title} — ${day(x.date)} ${safeUrl(x.link)}`)] : [])].join("\n") +
    `\n\nOpen Campus Pulse: ${SITE}\nTurn this off in Pulse → Weekly email.`;
  return { subject, html, text, stories: stories.length, visits: visits.length };
}

export async function runWeekly({ env = process.env, fetchImpl = fetch, now = new Date(), log = console, digest = digestFor } = {}) {
  const live = env.PULSE_WEEKLY_LIVE === "yes";
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const summary = { live, week: weekOf(now), people: 0, emails: 0, skipped: [], errors: [] };
  if (!key) { summary.errors.push("SUPABASE_SERVICE_ROLE_KEY not set — nothing sent"); log.error("[pulse-weekly]", summary.errors[0]); return summary; }
  if (live && !env.RESEND_API_KEY) { summary.errors.push("RESEND_API_KEY not set — nothing sent"); log.error("[pulse-weekly]", summary.errors[0]); return summary; }
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = async (path, opts = {}) => {
    const r = await fetchImpl(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`supabase ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? [] : r.json();
  };
  let prefs;
  try { prefs = await rest("reminder_prefs?pulse_weekly=eq.true&select=user_id,family_id"); }
  catch (e) { summary.errors.push("migration 011 not run yet — nothing sent"); log.error("[pulse-weekly]", e.message); return summary; }
  summary.people = prefs.length;
  if (!prefs.length) { log.log("[pulse-weekly] nobody has the weekly email on"); return summary; }
  const fams = [...new Set(prefs.map(p => p.family_id))];
  const boards = await rest(`family_schools?family_id=in.(${fams.join(",")})&select=family_id,school_id,name`);
  const sent = await rest(`pulse_weekly_log?week_start=eq.${summary.week}&select=user_id`);
  const done = new Set(sent.map(x => x.user_id));
  const cache = {};   // one digest per family
  for (const p of prefs) {
    try {
      if (done.has(p.user_id)) { summary.skipped.push(`${p.user_id}: already sent this week`); continue; }
      const mine = boards.filter(b => b.family_id === p.family_id && /^[a-z0-9-]{2,80}$/i.test(b.school_id)).slice(0, 30);
      if (!mine.length) { summary.skipped.push(`${p.user_id}: empty board`); continue; }
      if (!cache[p.family_id]) cache[p.family_id] = await digest(mine.map(b => b.school_id), { now: now.getTime(), budgetMs: 20000, withEvents: true });
      const mail = buildWeekly({ schools: cache[p.family_id].schools || {}, names: Object.fromEntries(mine.map(b => [b.school_id, b.name])), now: now.getTime() });
      if (!mail) { summary.skipped.push(`${p.user_id}: nothing new`); continue; }
      const u = await fetchImpl(`${SB_URL}/auth/v1/admin/users/${p.user_id}`, { headers: H });
      const email = u.ok ? (await u.json()).email : null;
      if (!email) { summary.skipped.push(`${p.user_id}: no email`); continue; }
      if (!live) { log.log(`[pulse-weekly] DRY RUN would email ${email}: ${mail.subject}`); summary.emails++; continue; }
      const ins = await rest("pulse_weekly_log?on_conflict=user_id,week_start", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify([{ user_id: p.user_id, family_id: p.family_id, week_start: summary.week }]) });
      if (!ins.length) { summary.skipped.push(`${p.user_id}: already sent this week`); continue; }
      const r = await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email, subject: mail.subject, html: mail.html, text: mail.text }) });
      if (!r.ok) { await rest(`pulse_weekly_log?user_id=eq.${p.user_id}&week_start=eq.${summary.week}`, { method: "DELETE" }); throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`); }
      summary.emails++;
    } catch (e) { summary.errors.push(`${p.user_id}: ${e.message}`); log.error("[pulse-weekly]", p.user_id, e.message); }
  }
  log.log("[pulse-weekly] done", JSON.stringify(summary));
  return summary;
}

export default async () => {
  const s = await runWeekly();
  return new Response(JSON.stringify(s), { status: 200, headers: { "Content-Type": "application/json" } });
};

// Mondays at 12:00 UTC = 8:00 AM Eastern (7:00 AM in winter).
export const config = { schedule: "0 12 * * 1" };
