// Owner back office (#63, built Oct 12). Lets the site owner see every family and account and manage them.
// Safety:
//  - Only signed-in OWNER emails get anything; everyone else gets 403. The check runs here on the server.
//  - Uses SUPABASE_SERVICE_ROLE_KEY (Netlify env, server-only — already set for reminders).
//  - Nothing is ever deleted. "Deactivate" is a reversible sign-in block (Supabase ban); "Reactivate" lifts it.
//  - Every change is written to the function log with who did it.
import { corsFor } from "../lib/guard.mjs";

const SB_URL = "https://heppyuzvztjzhgfitrsb.supabase.co";
const SB_PUBLIC = "sb_publishable_8vIYFyziJ0S_xFBm6vFhWg_Xp6paOLx";
const DEFAULT_OWNERS = ["oarthur@gmail.com"];
const PLANS = ["free", "family", "family_plus"];

export async function handle(body, token, { env = process.env, fetchImpl = fetch, log = console } = {}) {
  const owners = (env.OWNER_EMAILS ? env.OWNER_EMAILS.split(",") : DEFAULT_OWNERS).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!token) return [401, { error: "Sign in first." }];
  let me = null;
  try { const r = await fetchImpl(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_PUBLIC, Authorization: `Bearer ${token}` } }); if (r.ok) me = await r.json(); } catch (e) {}
  if (!me || !me.id) return [401, { error: "Sign in first." }];
  const email = String(me.email || "").toLowerCase();
  if (!owners.includes(email) || !me.email_confirmed_at && !me.confirmed_at) return [403, { error: "This page is for the site owner only." }];
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return [500, { error: "Server key missing (SUPABASE_SERVICE_ROLE_KEY)." }];
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = async (path, opts = {}) => {
    const r = await fetchImpl(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status}`);
    return r.status === 204 ? [] : r.json();
  };
  const restOpt = async path => { try { return await rest(path); } catch (e) { return null; } };   // tables that may not exist yet
  const action = body && body.action;

  if (action === "overview") {
    const [families, members, boards, photos, pending, visits] = await Promise.all([
      rest("families?select=id,name,plan,invite_code,created_at&order=created_at.desc"),
      rest("members?select=user_id,family_id,role,display_name,created_at"),
      restOpt("family_schools?select=family_id"), restOpt("photos?select=family_id"),
      restOpt("pending_students?select=family_id,display_name"), restOpt("visits?select=family_id")]);
    const ur = await fetchImpl(`${SB_URL}/auth/v1/admin/users?per_page=1000`, { headers: H });
    const users = ur.ok ? ((await ur.json()).users || []) : [];
    const count = (rows, fid) => rows ? rows.filter(r => r.family_id === fid).length : null;
    const userOut = users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
      active: !(u.banned_until && new Date(u.banned_until) > new Date()), family_id: (members.find(m => m.user_id === u.id) || {}).family_id || null }));
    return [200, {
      me: email, generated_at: new Date().toISOString(),
      totals: { families: families.length, accounts: users.length, active: userOut.filter(u => u.active).length,
        signedInLast7: userOut.filter(u => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at) < 7 * 864e5).length,
        byPlan: Object.fromEntries(PLANS.map(p => [p, families.filter(f => f.plan === p).length])) },
      families: families.map(f => ({ ...f, members: members.filter(m => m.family_id === f.id).map(m => ({ ...m, email: (users.find(u => u.id === m.user_id) || {}).email || null })),
        schools: count(boards, f.id), photos: count(photos, f.id), visits: count(visits, f.id), pendingStudent: (pending || []).find(p => p.family_id === f.id)?.display_name || null })),
      accounts: userOut
    }];
  }
  if (action === "setPlan") {
    const { family_id, plan } = body;
    if (!/^[0-9a-f-]{36}$/.test(family_id || "") || !PLANS.includes(plan)) return [400, { error: "Bad family or plan." }];
    await rest(`families?id=eq.${family_id}`, { method: "PATCH", body: JSON.stringify({ plan }), headers: { Prefer: "return=minimal" } });
    log.log(`[owner-admin] ${email} set family ${family_id} plan=${plan}`);
    return [200, { ok: true }];
  }
  if (action === "setActive") {
    const { user_id, active } = body;
    if (!/^[0-9a-f-]{36}$/.test(user_id || "") || typeof active !== "boolean") return [400, { error: "Bad account." }];
    if (user_id === me.id && !active) return [400, { error: "You can't deactivate your own account." }];
    const r = await fetchImpl(`${SB_URL}/auth/v1/admin/users/${user_id}`, { method: "PUT", headers: H, body: JSON.stringify({ ban_duration: active ? "none" : "876000h" }) });
    if (!r.ok) return [502, { error: `Couldn't update the account (${r.status}).` }];
    log.log(`[owner-admin] ${email} set user ${user_id} active=${active}`);
    return [200, { ok: true }];
  }
  return [400, { error: "Unknown action." }];
}

export default async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const h = req.headers.get("authorization") || ""; const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  let body = {}; try { body = await req.json(); } catch (e) {}
  let status, out;
  try { [status, out] = await handle(body, token); } catch (e) { console.error("[owner-admin]", e && e.message); [status, out] = [500, { error: "Something went wrong loading accounts." }]; }
  return new Response(JSON.stringify(out), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
