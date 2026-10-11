// Shared guard for the AI functions (Fix #8, Oct 11).
// 1) Only our own site may call them from a browser (CORS allow-list, not "*").
// 2) Caller must be signed in: the Supabase access token is checked against Supabase's
//    public /auth/v1/user endpoint (URL + publishable key are public, same as the page uses).
const SB_URL = "https://heppyuzvztjzhgfitrsb.supabase.co";
const SB_KEY = "sb_publishable_8vIYFyziJ0S_xFBm6vFhWg_Xp6paOLx";
const ORIGINS = ["https://zoescolleges.com", "https://www.zoescolleges.com"];

export function corsFor(req) {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^https:\/\/[a-z0-9-]+--zoescolleges\.netlify\.app$/.test(o); // deploy previews
  return {
    ...(ok ? { "Access-Control-Allow-Origin": o, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

export async function requireUser(req) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id } : null;
  } catch (e) { console.error("auth check failed", e && e.message); return null; }
}

// Global daily cap in Netlify Blobs. Errors are LOGGED (they were silently swallowed before).
export async function bumpDailyCap(storeName, cap) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: storeName, consistency: "strong" });
    const d = new Date().toISOString().slice(0, 10);
    const cur = (await store.get(d, { type: "json" })) || { n: 0 };
    const used = cur.n || 0;
    if (used >= cap) return { capped: true, used };
    await store.setJSON(d, { n: used + 1 });
    return { capped: false, used: used + 1 };
  } catch (e) {
    console.error(`[${storeName}] daily cap unavailable:`, e && e.message);
    return { capped: false, used: null, capError: true };
  }
}
