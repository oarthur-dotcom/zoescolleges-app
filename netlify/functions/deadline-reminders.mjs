// Daily deadline reminder emails (improvement #1, Oct 11).
// Runs on Netlify's schedule (see `config` at the bottom) — it is not callable from a browser.
// For each person who switched reminders ON: read their family's board, find deadlines 30 / 14 / 3
// days out (America/New_York), record each one in reminder_log (so it is never sent twice), and send
// ONE email per person listing what's coming up.
//
// Needs Netlify env vars: SUPABASE_SERVICE_ROLE_KEY (server-only), RESEND_API_KEY.
// SAFETY: sends nothing unless REMINDERS_LIVE = "yes". Otherwise it logs what it WOULD send (dry run).
import { deadlineList, daysBetween, windowFor } from "../lib/deadlines.mjs";

const SB_URL = "https://heppyuzvztjzhgfitrsb.supabase.co";
const CATALOG_URL = "https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@live/colleges.json";
const FROM = "Zoe's Colleges <hello@zoescolleges.com>";
const SITE = "https://zoescolleges.com";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
export function todayET(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); // YYYY-MM-DD
}
const nice = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const inDays = n => n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;

export function buildEmail(items) {
  items = items.slice().sort((a, b) => a.daysLeft - b.daysLeft);
  const first = items[0];
  const subject = `Deadline reminder: ${first.schoolName} ${first.kind} ${inDays(first.daysLeft)}` + (items.length > 1 ? ` (+${items.length - 1} more)` : "");
  const rows = items.map(i => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e7e4dd"><b>${esc(i.schoolName)}</b><br><span style="color:#5f6982">${esc(i.kind)} deadline · ${esc(nice(i.date))}</span></td><td style="padding:8px 10px;border-bottom:1px solid #e7e4dd;white-space:nowrap;font-weight:700;color:${i.daysLeft <= 3 ? "#b4441b" : "#0f7f80"}">${esc(inDays(i.daysLeft))}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#101c2e">
  <h2 style="margin:0 0 6px">Coming up on your college list</h2>
  <p style="margin:0 0 14px;color:#5f6982">From your family's board on Zoe's Colleges.</p>
  <table style="border-collapse:collapse;width:100%">${rows}</table>
  <p style="margin:16px 0 0"><a href="${SITE}" style="color:#0f7f80;font-weight:700">Open your Deadlines →</a></p>
  <p style="margin:18px 0 0;font-size:12px;color:#5f6982">Dates come from our research — always confirm on each school's admissions site before you apply.
  You're getting this because you turned on deadline reminders. Turn them off anytime in <b>Deadlines → Email reminders</b>.</p></div>`;
  const text = items.map(i => `${i.schoolName} — ${i.kind} deadline ${nice(i.date)} (${inDays(i.daysLeft)})`).join("\n") +
    `\n\nOpen your Deadlines: ${SITE}\nAlways confirm dates on each school's admissions site. Turn reminders off in Deadlines → Email reminders.`;
  return { subject, html, text };
}

export async function runReminders({ env = process.env, fetchImpl = fetch, now = new Date(), log = console } = {}) {
  const live = env.REMINDERS_LIVE === "yes";
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const summary = { live, today: todayET(now), people: 0, emails: 0, items: 0, skipped: [], errors: [] };
  if (!key) { summary.errors.push("SUPABASE_SERVICE_ROLE_KEY not set — nothing sent"); log.error("[reminders]", summary.errors[0]); return summary; }
  if (live && !env.RESEND_API_KEY) { summary.errors.push("RESEND_API_KEY not set — nothing sent"); log.error("[reminders]", summary.errors[0]); return summary; }
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = async (path, opts = {}) => {
    const r = await fetchImpl(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`supabase ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? [] : r.json();
  };

  const prefs = await rest("reminder_prefs?email_on=eq.true&select=user_id,family_id");
  summary.people = prefs.length;
  if (!prefs.length) { log.log("[reminders] nobody has reminders on"); return summary; }

  const cat = await (await fetchImpl(CATALOG_URL)).json();
  const byId = new Map((cat.colleges || []).map(c => [c.id, c]));
  const fams = [...new Set(prefs.map(p => p.family_id))];
  const boards = await rest(`family_schools?family_id=in.(${fams.join(",")})&select=family_id,school_id,name`);

  for (const p of prefs) {
    try {
      const u = await fetchImpl(`${SB_URL}/auth/v1/admin/users/${p.user_id}`, { headers: H });
      const email = u.ok ? (await u.json()).email : null;
      if (!email) { summary.skipped.push(`${p.user_id}: no email`); continue; }

      const due = [];
      for (const s of boards.filter(b => b.family_id === p.family_id)) {
        const info = byId.get(s.school_id); if (!info) continue;
        for (const dl of deadlineList(info)) {
          const n = daysBetween(summary.today, dl.date); const w = windowFor(n);
          if (w == null) continue;
          due.push({ user_id: p.user_id, family_id: p.family_id, school_id: s.school_id, kind: dl.kind, deadline_date: dl.date, days_before: w,
                     _school: info.name || s.name, _days: n });
        }
      }
      if (!due.length) continue;

      // Record first (unique key = never twice). Only rows actually inserted are new.
      let fresh;
      if (live) {
        fresh = await rest("reminder_log?on_conflict=user_id,school_id,kind,deadline_date,days_before", {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify(due.map(({ _school, _days, ...row }) => row)) });
      } else {
        const sent = await rest(`reminder_log?user_id=eq.${p.user_id}&select=school_id,kind,deadline_date,days_before`);
        const seen = new Set(sent.map(x => [x.school_id, x.kind, x.deadline_date, x.days_before].join("|")));
        fresh = due.filter(x => !seen.has([x.school_id, x.kind, x.deadline_date, x.days_before].join("|")));
      }
      if (!fresh.length) continue;
      const key2 = x => [x.school_id, x.kind, x.deadline_date, x.days_before].join("|");
      const freshKeys = new Set(fresh.map(key2));
      const items = due.filter(x => freshKeys.has(key2(x))).map(x => ({ schoolName: x._school, kind: x.kind, date: x.deadline_date, daysLeft: x._days }));
      const mail = buildEmail(items);

      if (!live) { log.log(`[reminders] DRY RUN would email ${email}: ${mail.subject}`); summary.emails++; summary.items += items.length; continue; }

      const r = await fetchImpl("https://api.resend.com/emails", { method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email, subject: mail.subject, html: mail.html, text: mail.text }) });
      if (!r.ok) {   // undo the log rows so a re-run can send them
        const ids = fresh.map(x => x.id).filter(Boolean);
        if (ids.length) await rest(`reminder_log?id=in.(${ids.join(",")})`, { method: "DELETE" });
        throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
      }
      summary.emails++; summary.items += items.length;
    } catch (e) { summary.errors.push(`${p.user_id}: ${e.message}`); log.error("[reminders]", p.user_id, e.message); }
  }
  log.log("[reminders] done", JSON.stringify(summary));
  return summary;
}

export default async () => {
  const s = await runReminders();
  return new Response(JSON.stringify(s), { status: 200, headers: { "Content-Type": "application/json" } });
};

// Every day at 13:00 UTC = 9:00 AM Eastern (8:00 AM in winter).
export const config = { schedule: "0 13 * * *" };
