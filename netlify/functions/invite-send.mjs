// Invite a family member by email, from inside the app (#67, Oct 11).
// The signed-in member types a name + email; we send ONE short email from hello@zoescolleges.com with a
// one-tap join link (?join=<family invite code>). Nothing about the student is in the email.
// Guards: signed in; only parents can invite; seat check (same rule as join_family); max 5 invites per
// family per day and max 1 per address per day; 300/day site-wide; never to the inviter's own address.
// The limiter FAILS CLOSED (if it can't count, it doesn't send) so our domain can't be used for spam.
// Needs Netlify env vars: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
import { corsFor } from "../lib/guard.mjs";

const SB_URL = "https://heppyuzvztjzhgfitrsb.supabase.co";
const SB_KEY = "sb_publishable_8vIYFyziJ0S_xFBm6vFhWg_Xp6paOLx";   // public, same as the page
const FROM = "Zoe's Colleges <hello@zoescolleges.com>";
const SITE = "https://zoescolleges.com";
const PER_FAMILY = 5, SITE_WIDE = 300;
const SEATS = { free: 2, family: 99, family_plus: 99 };

let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EMAIL_RX = /^[^\s@<>"']{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const DISPOSABLE = /(mailinator|guerrillamail|10minutemail|tempmail|trashmail|yopmail|sharklasers|getnada|dispostable)\./i;

export function buildInvite({ inviter, family, name, link, code }) {
  const hi = name ? `Hi ${esc(name)},` : "Hi,";
  const subject = `${inviter} invited you to the ${family} college board`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#101c2e;line-height:1.5">
  <p>${hi}</p>
  <p><b>${esc(inviter)}</b> invited you to join the <b>${esc(family)}</b> board on Zoe's Colleges, a shared place for your family's college search.</p>
  <p style="margin:22px 0"><a href="${link}" style="background:#0b7f81;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;display:inline-block">Join the family board</a></p>
  <p style="color:#5f6982;font-size:13px">Or open ${esc(SITE)} and enter this invite code: <b style="font-family:monospace;color:#101c2e">${esc(code)}</b></p>
  <p style="color:#5f6982;font-size:12px;margin-top:22px">You got this because ${esc(inviter)} typed your email address. If you weren't expecting it, you can ignore it — nothing happens unless you join.</p></div>`;
  const text = `${name ? `Hi ${name},\n\n` : ""}${inviter} invited you to join the ${family} board on Zoe's Colleges.\n\nJoin: ${link}\nOr enter invite code ${code} at ${SITE}\n\nYou got this because ${inviter} typed your email address. If you weren't expecting it, ignore it.`;
  return { subject, html, text };
}

async function counter(key, limit) {   // returns {ok:boolean} — fails CLOSED
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "invite-usage", consistency: "strong" });
    const cur = (await store.get(key, { type: "json" })) || { n: 0, to: [] };
    return { store, cur, ok: (cur.n || 0) < limit };
  } catch (e) { console.error("[invite] limiter unavailable:", e && e.message); return { ok: false, down: true }; }
}

export default async (req, ctx, deps = {}) => {
  const fetchImpl = deps.fetch || fetch; const env = deps.env || process.env; const count = deps.counter || counter;
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = env.SUPABASE_SERVICE_ROLE_KEY, resend = env.RESEND_API_KEY;
  if (!key || !resend) return json({ error: "Email invites aren't switched on yet — use Copy link for now.", unconfigured: true });

  // who is asking
  const h = req.headers.get("authorization") || ""; const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return json({ error: "Please sign in again, then retry." }, 401);
  const ur = await fetchImpl(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
  if (!ur.ok) return json({ error: "Please sign in again, then retry." }, 401);
  const me = await ur.json(); if (!me || !me.id) return json({ error: "Please sign in again, then retry." }, 401);

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const name = String(body.name || "").trim().replace(/[\r\n<>]/g, "").slice(0, 40);
  if (!EMAIL_RX.test(email)) return json({ error: "That email address doesn't look right." }, 400);
  if (DISPOSABLE.test(email)) return json({ error: "Please use a regular email address." }, 400);
  if (me.email && email === String(me.email).toLowerCase()) return json({ error: "That's your own address — invite someone else." }, 400);

  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const rest = async p => { const r = await fetchImpl(`${SB_URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`supabase ${r.status}`); return r.json(); };
  let mem, fam, members;
  try {
    mem = (await rest(`members?user_id=eq.${encodeURIComponent(me.id)}&select=family_id,role,display_name`))[0];
    if (!mem) return json({ error: "Set up your family first." }, 400);
    if (mem.role === "student") return json({ error: "Ask a parent to send invites." }, 403);
    fam = (await rest(`families?id=eq.${encodeURIComponent(mem.family_id)}&select=id,name,invite_code,plan`))[0];
    members = await rest(`members?family_id=eq.${encodeURIComponent(mem.family_id)}&select=user_id`);
  } catch (e) { console.error("[invite]", e.message); return json({ error: "Couldn't send right now — use Copy link instead." }, 502); }
  if (!fam || !fam.invite_code) return json({ error: "Set up your family first." }, 400);
  const seats = SEATS[fam.plan] ?? 2;
  if (members.length >= seats) return json({ error: `Your family is full (${seats} people on this plan).`, full: true }, 409);

  // limits (fail closed)
  const day = new Date().toISOString().slice(0, 10);
  const fc = await count(`${day}:${fam.id}`, PER_FAMILY);
  if (fc.down) return json({ error: "Email invites are busy right now — use Copy link instead." }, 503);
  if (!fc.ok) return json({ error: `That's ${PER_FAMILY} email invites today — use Copy link, or try tomorrow.`, limited: true }, 429);
  if ((fc.cur.to || []).includes(email)) return json({ error: "Already sent to that address today." , limited: true }, 429);
  const sc = await count(`${day}:all`, SITE_WIDE);
  if (sc.down || !sc.ok) return json({ error: "Email invites are busy right now — use Copy link instead." }, 503);

  const inviter = (mem.display_name || "Your family").slice(0, 40), family = (fam.name || "family").slice(0, 60);
  const link = `${SITE}/?join=${encodeURIComponent(fam.invite_code)}`;
  const mail = buildInvite({ inviter, family, name, link, code: fam.invite_code });
  const r = await fetchImpl("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: email, subject: mail.subject, html: mail.html, text: mail.text }) });
  if (!r.ok) { console.error("[invite] resend", r.status, (await r.text()).slice(0, 200)); return json({ error: "Couldn't send right now — use Copy link instead." }, 502); }
  try {
    await fc.store.setJSON(`${day}:${fam.id}`, { n: (fc.cur.n || 0) + 1, to: [...(fc.cur.to || []), email].slice(-20) });
    await sc.store.setJSON(`${day}:all`, { n: (sc.cur.n || 0) + 1 });
  } catch (e) { console.error("[invite] count write failed:", e && e.message); }
  console.log("[invite] sent for family", fam.id);   // no addresses in logs
  return json({ sent: true });
};
